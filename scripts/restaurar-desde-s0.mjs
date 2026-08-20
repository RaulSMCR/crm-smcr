// scripts/restaurar-desde-s0.mjs
//
// Reinserta lo que el respaldo de S0 alcanzó a congelar, después de que la base
// de producción quedara vacía.
//
// NO es una restauración completa y no puede serlo. El respaldo de S0 se hizo
// para poder revertir un cambio de slug, no para sobrevivir a un desastre:
// cubre cuatro tablas, y de `User` solo las columnas que la cadena de slugs
// necesitaba. Todo lo demás —citas, pagos, facturas, mensajes, casos clínicos,
// asignaciones de servicio, taxonomía— no está en ningún lado.
//
//   node scripts/restaurar-desde-s0.mjs                 (dry-run, no escribe)
//   node scripts/restaurar-desde-s0.mjs --commit
//
// El dry-run es el modo por defecto y es obligatorio leerlo antes de escribir.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const COMMIT = process.argv.includes('--commit');
const RESPALDO = process.argv.find((a) => a.endsWith('.json')) || 'docs/backups/pre-seo-2026-08-19.json';

// Marcador de contraseña inutilizable: no es el hash de ninguna contraseña real,
// así que nadie puede entrar con él. Cada persona tiene que usar «recuperar
// acceso» para fijar una nueva. Es preferible a inventar una contraseña
// conocida, que sería una puerta abierta.
const SIN_CONTRASENA = 'RESTAURADO_SIN_CONTRASENA_USAR_RECUPERAR_ACCESO';

const d = JSON.parse(readFileSync(RESPALDO, 'utf8'));
const { Post, ProfessionalProfile, Service, User } = d.tablas;

function fecha(v) {
  return v ? new Date(v) : undefined;
}

/** Convierte las fechas ISO del JSON de vuelta a Date, recursivamente. */
function revivir(fila) {
  const out = {};
  for (const [k, v] of Object.entries(fila)) {
    if (v === null || v === undefined) { out[k] = v; continue; }
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v)) { out[k] = new Date(v); continue; }
    out[k] = v;
  }
  return out;
}

async function main() {
  console.log(`Respaldo: ${RESPALDO} (generado ${d.generadoEn})`);
  console.log(COMMIT ? '\n*** MODO ESCRITURA ***\n' : '\n--- dry-run: no se escribe nada ---\n');

  // --- Estado actual, para no pisar nada que ya exista -----------------------
  const actual = {
    user: await prisma.user.count(),
    professionalProfile: await prisma.professionalProfile.count(),
    service: await prisma.service.count(),
    post: await prisma.post.count(),
  };
  console.log('Filas hoy en la base:', JSON.stringify(actual));

  // --- Comprobación de claves foráneas antes de tocar nada -------------------
  const taxesExistentes = new Set((await prisma.tax.findMany({ select: { id: true } })).map((t) => t.id));
  const taxIdsUsados = [...new Set(Service.map((s) => s.taxId).filter(Boolean))];
  const taxIdsHuerfanos = taxIdsUsados.filter((id) => !taxesExistentes.has(id));

  const userIdsDelRespaldo = new Set(User.map((u) => u.id));
  const perfilesSinUsuario = ProfessionalProfile.filter((p) => !userIdsDelRespaldo.has(p.userId));

  const perfilIds = new Set(ProfessionalProfile.map((p) => p.id));
  const postsSinAutor = Post.filter((p) => !perfilIds.has(p.authorId));

  const postsConSerie = Post.filter((p) => p.seriesId);

  console.log('\nComprobaciones:');
  console.log(`  Tax referenciados por servicios: ${taxIdsUsados.length}, huérfanos: ${taxIdsHuerfanos.length}`);
  console.log(`  Perfiles sin su usuario en el respaldo: ${perfilesSinUsuario.length}`);
  console.log(`  Posts sin su autor en el respaldo:      ${postsSinAutor.length}`);
  console.log(`  Posts con seriesId (la serie no existe): ${postsConSerie.length}`);

  console.log('\nSe reinsertaría:');
  console.log(`  User                 ${User.length}   (sin contraseña ni teléfono: no estaban en el respaldo)`);
  console.log(`  ProfessionalProfile  ${ProfessionalProfile.length}   (todas las columnas)`);
  console.log(`  Service              ${Service.length}  (todas las columnas)`);
  console.log(`  Post                 ${Post.length}  (todas las columnas)`);

  console.log('\nNO se puede reinsertar, no está en ningún respaldo:');
  for (const t of [
    'ServiceAssignment — qué profesional presta qué servicio y a qué precio',
    'Appointment, PaymentTransaction, Invoice — toda la operación',
    'Message, Caso clínico, Availability',
    'Lead y atribución de marketing',
    'Series, Topic, Discipline — la taxonomía (estaba vacía igual)',
    'HomeCarouselItem — el carrusel de la home',
  ]) console.log(`  · ${t}`);

  if (!COMMIT) {
    console.log('\nPara escribir: node scripts/restaurar-desde-s0.mjs --commit');
    return;
  }

  if (actual.post || actual.professionalProfile || actual.service) {
    throw new Error('Ya hay contenido en la base. Este script es para una base vacía; abortado para no pisar nada.');
  }

  // El orden respeta las dependencias: usuario → perfil → post. Los servicios
  // son independientes. Todo en una transacción: o entra completo o no entra.
  await prisma.$transaction(async (tx) => {
    for (const u of User) {
      await tx.user.create({
        data: {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          createdAt: fecha(u.createdAt),
          passwordHash: SIN_CONTRASENA,
          phone: '',
          emailVerified: true,
        },
      });
    }
    console.log(`User: ${User.length} reinsertados`);

    for (const p of ProfessionalProfile) {
      const { user, ...campos } = p;
      await tx.professionalProfile.create({ data: revivir(campos) });
    }
    console.log(`ProfessionalProfile: ${ProfessionalProfile.length} reinsertados`);

    for (const s of Service) {
      const campos = revivir(s);
      if (campos.taxId && !taxesExistentes.has(campos.taxId)) campos.taxId = null;
      await tx.service.create({ data: campos });
    }
    console.log(`Service: ${Service.length} reinsertados`);

    for (const p of Post) {
      const campos = revivir(p);
      // La taxonomía no existe: dejar seriesId apuntando a una serie borrada
      // haría fallar la clave foránea.
      campos.seriesId = null;
      campos.seriesOrder = null;
      await tx.post.create({ data: campos });
    }
    console.log(`Post: ${Post.length} reinsertados`);
  }, { timeout: 120000 });

  console.log('\nListo. Verificar el sitio y avisar a cada persona que use «recuperar acceso».');
}

main()
  .catch((e) => { console.error('\nERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

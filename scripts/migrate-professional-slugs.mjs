// scripts/migrate-professional-slugs.mjs
//
// S5: repara los slugs de perfil profesional, sin perder ninguna URL.
//
//   node scripts/migrate-professional-slugs.mjs                  dry-run
//   node scripts/migrate-professional-slugs.mjs --overrides f
//   node scripts/migrate-professional-slugs.mjs --commit
//   node scripts/migrate-professional-slugs.mjs --revert <resp> --commit
//
// El bug de origen es distinto al de los artículos y por eso el criterio de
// detección también. En `auth-actions.js` el slug se armaba con
// `name.replace(/[^\w\s-]/g, "")`, y `\w` sin flag `u` es `[A-Za-z0-9_]`: la
// letra acentuada no coincidía y se **borraba**, en vez de convertirse en guión.
// "Raúl" quedó "Ral". No deja tokens sueltos ni guiones de más — deja una
// palabra a la que le falta una letra en el medio.
//
// Por eso acá el criterio es directo: se compara contra el nombre real de la
// persona. Son cuatro perfiles y el nombre es la fuente de verdad; no hace falta
// inferir nada como en S4.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/lib/slug.js';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const REVERT = args.includes('--revert');
const rutaRespaldo = args[args.indexOf('--revert') + 1];
const rutaOverrides = args.includes('--overrides') ? args[args.indexOf('--overrides') + 1] : null;
const overrides = rutaOverrides ? JSON.parse(readFileSync(rutaOverrides, 'utf8')) : {};

async function revertir() {
  const d = JSON.parse(readFileSync(rutaRespaldo, 'utf8'));
  const original = new Map(d.tablas.ProfessionalProfile.map((p) => [p.id, p.slug]));

  const actuales = await prisma.professionalProfile.findMany({ select: { id: true, slug: true } });
  const aRevertir = actuales.filter((p) => original.has(p.id) && original.get(p.id) !== p.slug);

  console.log(`Revertir ${aRevertir.length} slug(s) al estado de ${d.generadoEn}:`);
  for (const p of aRevertir) console.log(`  ${p.slug}  ->  ${original.get(p.id)}`);

  if (!COMMIT) return console.log('\nDry-run. Agregar --commit para revertir de verdad.');

  await prisma.$transaction(async (tx) => {
    for (const p of aRevertir) {
      await tx.slugRedirect.deleteMany({
        where: { entityType: 'professional', fromSlug: original.get(p.id) },
      });
      await tx.professionalProfile.update({ where: { id: p.id }, data: { slug: original.get(p.id) } });
    }
  });
  console.log('Revertido.');
}

async function migrar() {
  const perfiles = await prisma.professionalProfile.findMany({
    select: { id: true, slug: true, user: { select: { name: true, isActive: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const ocupados = new Set(perfiles.map((p) => p.slug).filter(Boolean));
  const plan = [];

  for (const perfil of perfiles) {
    const nombre = perfil.user?.name || '';
    const base = overrides[perfil.slug] ? slugify(overrides[perfil.slug]) : slugify(nombre);
    const origen = overrides[perfil.slug] ? 'editorial' : 'automático';

    if (!base) {
      plan.push({ perfil, nombre, accion: 'sin-slug-posible' });
      continue;
    }
    if (base === perfil.slug) {
      plan.push({ perfil, nombre, accion: 'ya-esta-bien', destino: perfil.slug });
      continue;
    }

    let destino = base;
    let i = 2;
    while (ocupados.has(destino) && destino !== perfil.slug) {
      destino = `${base}-${i}`;
      i += 1;
    }

    if (perfil.slug) ocupados.delete(perfil.slug);
    ocupados.add(destino);
    plan.push({
      perfil,
      nombre,
      accion: destino === base ? 'cambiar' : 'cambiar-con-sufijo',
      destino,
      origen,
    });
  }

  const cambios = plan.filter((p) => p.accion.startsWith('cambiar'));
  const iguales = plan.filter((p) => p.accion === 'ya-esta-bien');

  console.log(`\n${perfiles.length} perfiles · ${cambios.length} a cambiar · ${iguales.length} ya están bien\n`);

  for (const { perfil, nombre, destino, accion, origen } of cambios) {
    console.log(`  ${nombre}${perfil.user?.isActive ? '' : '   (usuario INACTIVO)'}`);
    console.log(`    de:  ${perfil.slug}`);
    console.log(`    a:   ${destino}`);
    if (accion === 'cambiar-con-sufijo') console.log('    ! COLISIÓN: se agregó sufijo');
    if (origen === 'editorial') console.log('    ! viene de --overrides');
    console.log('');
  }

  if (iguales.length) {
    console.log(`YA ESTÁN BIEN (${iguales.length}):`);
    for (const { perfil, nombre } of iguales) console.log(`  ${perfil.slug}   (${nombre})`);
    console.log('');
  }

  if (!COMMIT) {
    console.log('Dry-run: no se escribió nada.');
    console.log('Para aplicar: node scripts/migrate-professional-slugs.mjs --commit');
    return;
  }

  if (!cambios.length) return console.log('Nada que hacer.');

  for (const { perfil, destino } of cambios) {
    await prisma.$transaction(async (tx) => {
      await tx.professionalProfile.update({ where: { id: perfil.id }, data: { slug: destino } });
      if (perfil.slug) {
        await tx.slugRedirect.upsert({
          where: { entityType_fromSlug: { entityType: 'professional', fromSlug: perfil.slug } },
          update: { toSlug: destino },
          create: { entityType: 'professional', fromSlug: perfil.slug, toSlug: destino },
        });
      }
    });
    console.log(`  ${perfil.slug}  ->  ${destino}`);
  }

  console.log(`\n${cambios.length} slug(s) migrados, con su redirect registrado.`);
}

(REVERT ? revertir() : migrar())
  .catch((e) => { console.error('\nERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

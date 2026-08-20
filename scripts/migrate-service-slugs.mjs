// scripts/migrate-service-slugs.mjs
//
// S6: pone un slug legible a cada servicio y registra la URL con cuid como
// origen de redirect.
//
//   node scripts/migrate-service-slugs.mjs                  dry-run
//   node scripts/migrate-service-slugs.mjs --overrides f
//   node scripts/migrate-service-slugs.mjs --commit
//   node scripts/migrate-service-slugs.mjs --revert --commit
//
// A diferencia de S4 y S5, acá no hay nada que reparar: el slug no existía. Lo
// que se migra es la forma de la URL, de /servicios/{cuid} a /servicios/{slug}.
//
// El redirect se registra desde el cuid. La ruta pasa a llamarse `[slug]`, así
// que una URL con cuid falla la búsqueda por slug y cae en la tabla de
// redirects, que la manda al destino con un 308 — el mismo camino que usan los
// artículos y los perfiles, sin ninguna rama de compatibilidad propia.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { slugify } from '../src/lib/slug.js';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const COMMIT = args.includes('--commit');
const REVERT = args.includes('--revert');
const rutaOverrides = args.includes('--overrides') ? args[args.indexOf('--overrides') + 1] : null;
const overrides = rutaOverrides ? JSON.parse(readFileSync(rutaOverrides, 'utf8')) : {};

async function revertir() {
  // Revertir acá es distinto: no hay slug anterior al que volver, porque no
  // había ninguno. Se vacía la columna y se borran los redirects creados.
  const conSlug = await prisma.service.findMany({
    where: { slug: { not: null } },
    select: { id: true, slug: true, title: true },
  });

  console.log(`Vaciar el slug de ${conSlug.length} servicio(s) y borrar sus redirects:`);
  for (const s of conSlug) console.log(`  ${s.slug}   (${s.title})`);

  if (!COMMIT) return console.log('\nDry-run. Agregar --commit para revertir de verdad.');

  await prisma.$transaction(async (tx) => {
    for (const s of conSlug) {
      await tx.slugRedirect.deleteMany({ where: { entityType: 'service', toSlug: s.slug } });
      await tx.service.update({ where: { id: s.id }, data: { slug: null } });
    }
  });
  console.log('Revertido. Ojo: la columna es NOT NULL si ya corrió la migración de required.');
}

async function migrar() {
  const servicios = await prisma.service.findMany({
    select: { id: true, title: true, slug: true, isActive: true },
    orderBy: { displayOrder: 'asc' },
  });

  const ocupados = new Set(servicios.map((s) => s.slug).filter(Boolean));
  const plan = [];

  for (const servicio of servicios) {
    const base = overrides[servicio.id] ? slugify(overrides[servicio.id]) : slugify(servicio.title);
    const origen = overrides[servicio.id] ? 'editorial' : 'automático';

    if (!base) {
      plan.push({ servicio, accion: 'sin-slug-posible' });
      continue;
    }
    if (base === servicio.slug) {
      plan.push({ servicio, accion: 'ya-esta-bien', destino: servicio.slug });
      continue;
    }

    let destino = base;
    let i = 2;
    while (ocupados.has(destino) && destino !== servicio.slug) {
      destino = `${base}-${i}`;
      i += 1;
    }

    if (servicio.slug) ocupados.delete(servicio.slug);
    ocupados.add(destino);
    plan.push({ servicio, accion: 'asignar', destino, origen, colision: destino !== base });
  }

  const asignar = plan.filter((p) => p.accion === 'asignar');
  const iguales = plan.filter((p) => p.accion === 'ya-esta-bien');
  const problemas = plan.filter((p) => p.accion === 'sin-slug-posible');

  console.log(`\n${servicios.length} servicios · ${asignar.length} a asignar · ${iguales.length} ya tienen · ${problemas.length} sin slug posible\n`);

  for (const { servicio, destino, origen, colision } of asignar) {
    console.log(`  ${servicio.title}${servicio.isActive ? '' : '   (INACTIVO)'}`);
    console.log(`    /servicios/${servicio.id}`);
    console.log(`    /servicios/${destino}`);
    if (colision) console.log('    ! COLISIÓN: se agregó sufijo');
    if (origen === 'editorial') console.log('    ! viene de --overrides');
    console.log('');
  }

  for (const { servicio } of problemas) {
    console.log(`  ! "${servicio.title}" no produce slug usable. Necesita --overrides.`);
  }

  if (!COMMIT) {
    console.log('Dry-run: no se escribió nada.');
    console.log('Para aplicar: node scripts/migrate-service-slugs.mjs --commit');
    return;
  }

  if (!asignar.length) return console.log('Nada que hacer.');

  for (const { servicio, destino } of asignar) {
    await prisma.$transaction(async (tx) => {
      await tx.service.update({ where: { id: servicio.id }, data: { slug: destino } });
      await tx.slugRedirect.upsert({
        where: { entityType_fromSlug: { entityType: 'service', fromSlug: servicio.id } },
        update: { toSlug: destino },
        create: { entityType: 'service', fromSlug: servicio.id, toSlug: destino },
      });
    });
    console.log(`  ${servicio.id}  ->  ${destino}`);
  }

  console.log(`\n${asignar.length} servicio(s) con slug, y su URL con cuid registrada como redirect.`);
}

(REVERT ? revertir() : migrar())
  .catch((e) => { console.error('\nERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

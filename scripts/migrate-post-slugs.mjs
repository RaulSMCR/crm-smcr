// scripts/migrate-post-slugs.mjs
//
// S4: repara los slugs de artículo mutilados, sin perder ninguna URL.
//
//   node scripts/migrate-post-slugs.mjs                  dry-run (por defecto)
//   node scripts/migrate-post-slugs.mjs --overrides f     con ajustes editoriales
//   node scripts/migrate-post-slugs.mjs --commit         escribe
//   node scripts/migrate-post-slugs.mjs --revert <resp> --commit
//
// El dry-run es obligatorio antes de escribir, y su tabla está pensada para que
// una persona la lea y decida.
//
// Cada cambio va en una transacción que hace dos cosas en este orden: actualiza
// el slug e inserta el redirect del viejo. Si el redirect no se puede escribir,
// el cambio de slug tampoco queda — perder la URL vieja sin registrar a dónde
// fue es exactamente lo que este segmento existe para evitar.

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

/** Sobreescrituras editoriales: `{ "slug-actual": "slug-que-quiero" }`. */
const overrides = rutaOverrides ? JSON.parse(readFileSync(rutaOverrides, 'utf8')) : {};

// Palabras cortas legítimas del español: si un token de una o dos letras es una
// de estas, no es evidencia de nada.
const CORTAS_LEGITIMAS = new Set([
  'a', 'al', 'de', 'del', 'el', 'en', 'es', 'la', 'lo', 'las', 'los', 'un', 'una',
  'y', 'o', 'su', 'sus', 'se', 'si', 'no', 'ya', 'mas', 'con', 'por', 'que',
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'xx', 'xxi',
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
]);

/**
 * ¿Este slug lo produjo la función rota, o lo eligió una persona?
 *
 * La distinción es el corazón de S4. Comparar contra `slugify(title)` no sirve
 * como criterio: siete artículos tienen slugs cortos y legibles —como
 * `mundo-encerro-locura-nacimiento-clinica`— que alguien eligió a mano y son
 * MEJORES que el título entero convertido y recortado a 80 caracteres. Cambiar
 * esos no arregla nada y quema una URL indexada.
 *
 * Lo que sí hay que reparar es la firma del bug: donde había una letra acentuada
 * quedó un guión. Se detecta por dos vías, y alcanza con cualquiera:
 *
 *  1. Un token de una o dos letras que no es palabra corta legítima. La `é` de
 *     "Qué" dejó `qu`; la `ó` de "Lógicas" dejó `l`; la `ó` de "introducción"
 *     dejó una `n` suelta.
 *
 *  2. Dos tokens consecutivos que, pegados, forman una palabra del título a la
 *     que le falta exactamente una letra: `psic` + `logo` = `psiclogo`, y el
 *     título dice `psicologo`. Esta vía atrapa los casos donde el guión cayó en
 *     medio de una palabra larga sin dejar ningún fragmento corto.
 */
function estaRoto(slug, title) {
  const tokens = slug.split('-').filter(Boolean);

  for (const t of tokens) {
    if (t.length <= 2 && !CORTAS_LEGITIMAS.has(t)) return `token suelto "${t}"`;
  }

  // Sufijo de colisión aleatorio (H-30): `Math.random().toString(36).slice(2,7)`
  // deja cinco caracteres de ruido con letras y dígitos mezclados. Hay un
  // artículo publicado terminado en `-8oyy6`.
  const ultimo = tokens[tokens.length - 1] || '';
  if (/^[a-z0-9]{5}$/.test(ultimo) && /[0-9]/.test(ultimo) && /[a-z]/.test(ultimo) && !CORTAS_LEGITIMAS.has(ultimo)) {
    return `sufijo aleatorio "${ultimo}"`;
  }

  const palabras = new Set(slugify(title, { maxLength: 0 }).split('-').filter(Boolean));
  for (let i = 0; i < tokens.length - 1; i += 1) {
    // Si los dos tokens son palabras legítimas, pegarlos y encontrar un parecido
    // es casualidad, no evidencia: `a` + `la` da `ala`, que se parece a `alma`.
    if (CORTAS_LEGITIMAS.has(tokens[i]) && CORTAS_LEGITIMAS.has(tokens[i + 1])) continue;
    const pegado = tokens[i] + tokens[i + 1];
    for (const palabra of palabras) {
      if (palabra.length !== pegado.length + 1) continue;
      for (let k = 0; k < palabra.length; k += 1) {
        if (palabra.slice(0, k) + palabra.slice(k + 1) === pegado) {
          return `"${tokens[i]}-${tokens[i + 1]}" debería ser "${palabra}"`;
        }
      }
    }
  }

  return null;
}

function propuesto(post) {
  if (overrides[post.slug]) return { slug: slugify(overrides[post.slug]), origen: 'editorial' };
  return { slug: slugify(post.title), origen: 'automático' };
}

async function revertir() {
  const d = JSON.parse(readFileSync(rutaRespaldo, 'utf8'));
  const original = new Map(d.tablas.Post.map((p) => [p.id, p.slug]));

  const actuales = await prisma.post.findMany({ select: { id: true, slug: true } });
  const aRevertir = actuales.filter((p) => original.has(p.id) && original.get(p.id) !== p.slug);

  console.log(`Revertir ${aRevertir.length} slug(s) al estado de ${d.generadoEn}:`);
  for (const p of aRevertir) console.log(`  ${p.slug}  ->  ${original.get(p.id)}`);

  if (!COMMIT) return console.log('\nDry-run. Agregar --commit para revertir de verdad.');

  await prisma.$transaction(async (tx) => {
    for (const p of aRevertir) {
      // El redirect creado en la corrida original se borra: si la URL vuelve a
      // ser la vieja, un redirect desde ella crearía un bucle.
      await tx.slugRedirect.deleteMany({ where: { entityType: 'post', fromSlug: original.get(p.id) } });
      await tx.post.update({ where: { id: p.id }, data: { slug: original.get(p.id) } });
    }
  });
  console.log('Revertido.');
}

async function migrar() {
  const posts = await prisma.post.findMany({
    select: { id: true, title: true, slug: true, status: true },
    orderBy: { createdAt: 'asc' },
  });

  const ocupados = new Set(posts.map((p) => p.slug));
  const plan = [];

  for (const post of posts) {
    const { slug: base, origen } = propuesto(post);

    if (!base) {
      plan.push({ post, accion: 'sin-slug-posible', origen });
      continue;
    }
    if (base === post.slug) {
      plan.push({ post, accion: 'ya-esta-bien', destino: post.slug, origen });
      continue;
    }

    // Difiere del título, pero eso solo no justifica tocarlo. Sin evidencia del
    // bug y sin sobreescritura explícita, se deja como está.
    const roto = estaRoto(post.slug, post.title);
    if (!roto && origen !== 'editorial') {
      plan.push({ post, accion: 'limpio-pero-distinto', destino: base, origen });
      continue;
    }

    let destino = base;
    let i = 2;
    while (ocupados.has(destino) && destino !== post.slug) {
      destino = `${base}-${i}`;
      i += 1;
    }

    ocupados.delete(post.slug);
    ocupados.add(destino);
    plan.push({
      post,
      accion: destino === base ? 'cambiar' : 'cambiar-con-sufijo',
      destino,
      origen,
      motivo: roto,
    });
  }

  const cambios = plan.filter((p) => p.accion.startsWith('cambiar'));
  const limpios = plan.filter((p) => p.accion === 'limpio-pero-distinto');
  const iguales = plan.filter((p) => p.accion === 'ya-esta-bien');
  const problemas = plan.filter((p) => p.accion === 'sin-slug-posible');

  console.log(
    `\n${posts.length} artículos · ${cambios.length} rotos a reparar · ` +
      `${limpios.length} limpios pero distintos del título · ${iguales.length} coinciden · ` +
      `${problemas.length} sin slug posible\n`
  );

  if (cambios.length) {
    console.log('A REPARAR — revisar uno por uno antes de aprobar\n');
    for (const { post, destino, accion, origen, motivo } of cambios) {
      console.log(`  ${post.title}`);
      console.log(`    de:      ${post.slug}`);
      console.log(`    a:       ${destino}`);
      console.log(`    motivo:  ${motivo || 'sobreescritura editorial'}`);
      if (accion === 'cambiar-con-sufijo') console.log('    ! COLISIÓN: se agregó sufijo');
      if (origen === 'editorial') console.log('    ! viene de --overrides');
      console.log('');
    }
  }

  if (limpios.length) {
    console.log(`NO SE TOCAN — limpios, aunque no coincidan con el título (${limpios.length}).`);
    console.log('Son slugs legibles que alguien eligió; el automático sería más largo y peor.');
    console.log('Si aun así querés cambiar alguno, va por --overrides.\n');
    for (const { post, destino } of limpios) {
      console.log(`  ${post.slug}`);
      console.log(`    (el automático sería: ${destino})`);
    }
    console.log('');
  }

  if (iguales.length) {
    console.log(`YA COINCIDEN con el título (${iguales.length}):`);
    for (const { post } of iguales) console.log(`  ${post.slug}`);
    console.log('');
  }

  for (const { post } of problemas) {
    console.log(`  ! "${post.title}" no produce ningún slug usable. Necesita sobreescritura editorial.`);
  }

  if (!COMMIT) {
    console.log('Dry-run: no se escribió nada.');
    console.log('Para ajustar un slug a mano: JSON { "slug-actual": "slug-deseado" } con --overrides.');
    console.log('Para aplicar: node scripts/migrate-post-slugs.mjs --commit');
    return;
  }

  if (!cambios.length) return console.log('Nada que hacer.');

  for (const { post, destino } of cambios) {
    await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id: post.id }, data: { slug: destino } });
      await tx.slugRedirect.upsert({
        where: { entityType_fromSlug: { entityType: 'post', fromSlug: post.slug } },
        update: { toSlug: destino },
        create: { entityType: 'post', fromSlug: post.slug, toSlug: destino },
      });
    });
    console.log(`  ${post.slug}  ->  ${destino}`);
  }

  console.log(`\n${cambios.length} slug(s) migrados, con su redirect registrado.`);
  console.log('Siguiente paso manual: pedir reindexación en Search Console de las URLs nuevas.');
}

(REVERT ? revertir() : migrar())
  .catch((e) => { console.error('\nERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

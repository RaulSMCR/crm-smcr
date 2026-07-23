// scripts/fix-public-buckets.mjs
//
// Arreglo único: vuelve PÚBLICOS los buckets de imágenes.
//
// Contexto: los buckets `post-covers`, `avatars` y `service-banners` existían en
// PRIVADO. Subir funcionaba, pero la URL pública devolvía 400 "Bucket not found"
// y toda imagen caía al mismo fallback local (todos los artículos con la misma
// portada equivocada). Volverlos públicos recupera también los objetos ya
// subidos, así que este script repara las portadas existentes de una vez.
//
// A partir de ahora `uploadPublicImage` garantiza el flag público en cada subida
// (src/lib/storage.js, ensurePublicBucket), de modo que esto no debería volver a
// hacer falta. Se deja como herramienta de recuperación.
//
// Uso (necesita el service role key de producción en el entorno):
//   node scripts/fix-public-buckets.mjs
//
// Lee SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_URL de .env.local / .env
// o del entorno. En local esa key suele estar vacía: correr con las de prod.

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKETS = ['post-covers', 'avatars', 'service-banners'];
const MAX_BYTES = 5 * 1024 * 1024;
const MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env.local', '.env']) {
    const p = path.join(process.cwd(), file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].replace(/^["']|["']$/g, '');
      // No pisar lo que ya venga del entorno real y no aceptar vacíos.
      if (!env[key] && val) env[key] = val;
    }
  }
  return env;
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  console.error('El service role key suele estar vacío en local: correr con las variables de producción.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const opts = { public: true, fileSizeLimit: MAX_BYTES, allowedMimeTypes: MIME };

for (const bucket of BUCKETS) {
  const { error: updateError } = await supabase.storage.updateBucket(bucket, opts);
  if (!updateError) {
    console.log(`✓ ${bucket}: ahora es público`);
    continue;
  }
  if (String(updateError.message || '').toLowerCase().includes('not found')) {
    const { error: createError } = await supabase.storage.createBucket(bucket, opts);
    if (createError) console.error(`✗ ${bucket}: ${createError.message}`);
    else console.log(`✓ ${bucket}: creado público (no existía)`);
  } else {
    console.error(`✗ ${bucket}: ${updateError.message}`);
  }
}

// Verificación: lista el estado final.
const { data: buckets, error } = await supabase.storage.listBuckets();
if (!error) {
  console.log('\nEstado final:');
  for (const b of buckets.filter((x) => BUCKETS.includes(x.name))) {
    console.log(`  ${b.name.padEnd(18)} public=${b.public}`);
  }
}

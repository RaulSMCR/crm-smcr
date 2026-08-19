// scripts/verify-seo.mjs
//
// Arnés de verificación del plan SEO/GEO (S0). Recorre una lista de URLs y
// reporta, por cada una, lo que un crawler ve sin ejecutar JavaScript: código
// HTTP, título, canónico, robots y los bloques JSON-LD con su @type.
//
// Ese "sin ejecutar JavaScript" es el punto. Varios hallazgos de la auditoría
// (el fallback de portada, el grafo JSON-LD) dependen de qué llega en el HTML
// inicial, no de qué pinta React después. Un navegador headless mentiría acá.
//
//   node scripts/verify-seo.mjs docs/backups/urls-produccion-2026-08-19.txt
//   node scripts/verify-seo.mjs <archivo> --out docs/backups/baseline-tecnico-2026-08-19.json
//   node scripts/verify-seo.mjs <archivo> --base http://localhost:3000
//   node scripts/verify-seo.mjs <archivo> --diff docs/backups/baseline-tecnico-2026-08-19.json
//
// Sin dependencias: fetch nativo y expresiones regulares. Parsear HTML con
// regex es frágil en general, pero acá el universo es cerrado —etiquetas que
// Next genera con formato estable— y la alternativa era sumar una dependencia
// para leer cinco campos.

import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--'));
const comoJson = args.includes('--json');

function valorDe(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

const salida = valorDe('--out');
const baseNueva = valorDe('--base');
const anterior = valorDe('--diff');
const CONCURRENCIA = Number(valorDe('--concurrencia') || 4);

if (!archivo) {
  console.error('Uso: node scripts/verify-seo.mjs <archivo-de-urls> [--json] [--out f] [--base URL] [--diff baseline.json]');
  process.exit(1);
}

// --- extracción -------------------------------------------------------------

// El HTML de Next viene con los atributos en orden variable, así que se busca
// la etiqueta primero y el atributo después, en vez de un patrón rígido.
function etiquetas(html, nombre) {
  const re = new RegExp(`<${nombre}\\b[^>]*>`, 'gi');
  return html.match(re) || [];
}

function atributo(tag, nombre) {
  const m = tag.match(new RegExp(`\\b${nombre}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3]) : null;
}

function decodificar(texto) {
  if (texto == null) return null;
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .trim();
}

function tipos(nodo, acc = []) {
  if (!nodo || typeof nodo !== 'object') return acc;
  if (Array.isArray(nodo)) {
    nodo.forEach((n) => tipos(n, acc));
    return acc;
  }
  // Solo se descienden las claves que arman grafo. Recorrer el objeto entero
  // devolvería el @type de cada autor, logo y breadcrumb, y el informe dejaría
  // de servir para comparar páginas entre sí.
  if (nodo['@type']) acc.push(...[].concat(nodo['@type']));
  for (const clave of ['@graph', 'itemListElement', 'mainEntity']) {
    if (nodo[clave]) tipos(nodo[clave], acc);
  }
  return acc;
}

function analizar(html) {
  const title = decodificar((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);

  let canonical = null;
  for (const tag of etiquetas(html, 'link')) {
    if ((atributo(tag, 'rel') || '').toLowerCase() === 'canonical') canonical = atributo(tag, 'href');
  }

  let robots = null;
  let description = null;
  let ogUrl = null;
  let ogImage = null;
  for (const tag of etiquetas(html, 'meta')) {
    const name = (atributo(tag, 'name') || '').toLowerCase();
    const prop = (atributo(tag, 'property') || '').toLowerCase();
    const content = decodificar(atributo(tag, 'content'));
    if (name === 'robots') robots = content;
    if (name === 'description') description = content;
    if (prop === 'og:url') ogUrl = content;
    if (prop === 'og:image') ogImage = content;
  }

  const bloques = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      bloques.push({ tipos: tipos(JSON.parse(m[1])), invalido: false });
    } catch {
      // Un bloque que no parsea es un hallazgo, no un error del arnés: se
      // registra y se sigue.
      bloques.push({ tipos: [], invalido: true });
    }
  }

  const lang = (html.match(/<html[^>]*\blang\s*=\s*["']([^"']+)["']/i) || [])[1] || null;

  return {
    title,
    canonical,
    robots,
    description,
    ogUrl,
    ogImage,
    lang,
    jsonLd: bloques.map((b) => b.tipos),
    jsonLdInvalidos: bloques.filter((b) => b.invalido).length,
    tiposJsonLd: [...new Set(bloques.flatMap((b) => b.tipos))],
  };
}

// --- recorrido --------------------------------------------------------------

async function revisar(url) {
  const inicio = Date.now();
  try {
    // `redirect: manual` es deliberado: el objetivo del plan es comprobar que
    // los slugs viejos devuelven 301, y `follow` los convertiría en 200 y
    // escondería justamente lo que hay que verificar.
    const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'verify-seo/1.0 (+smcr)' } });
    const base = { url, status: res.status, ms: Date.now() - inicio };

    if (res.status >= 300 && res.status < 400) {
      return { ...base, location: res.headers.get('location') };
    }
    const html = await res.text();
    return { ...base, ...analizar(html) };
  } catch (e) {
    return { url, status: 0, error: String(e.message || e), ms: Date.now() - inicio };
  }
}

async function enTanda(urls, n, fn) {
  const out = new Array(urls.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, urls.length) }, async () => {
      while (i < urls.length) {
        const idx = i++;
        out[idx] = await fn(urls[idx]);
      }
    })
  );
  return out;
}

// --- informe ----------------------------------------------------------------

function normalizar(u) {
  return String(u || '').replace(/\/+$/, '');
}

/** Ruta sin dominio ni barra final. */
function ruta(u) {
  try {
    return new URL(u).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return normalizar(u) || '/';
  }
}

/**
 * ¿El canónico apunta a esta misma página?
 *
 * Se compara por ruta, no por URL completa, porque con `--base` la petición va a
 * localhost mientras el canónico sigue declarando el dominio de producción —que
 * es lo correcto—. Comparar cadenas enteras marcaba las 40 URLs como rotas.
 */
function apuntaASiMisma(r) {
  return ruta(r.canonical) === ruta(r.url);
}

/** ¿La página se declara no indexable? */
function esNoindex(r) {
  return /noindex/i.test(String(r.robots || ''));
}

function problemas(r) {
  const p = [];
  if (r.status === 0) p.push(`inalcanzable: ${r.error}`);
  else if (r.status >= 400) p.push(`HTTP ${r.status}`);
  else if (r.status >= 300) p.push(`redirige a ${r.location}`);
  else if (esNoindex(r)) {
    // Una página noindex no necesita canónico ni JSON-LD: pedírselos sería
    // reportar como defecto justamente lo que se buscaba.
    if (r.canonical && !apuntaASiMisma(r)) p.push(`noindex, pero con canónico ajeno -> ${r.canonical}`);
  } else {
    if (!r.title) p.push('sin <title>');
    if (!r.canonical) p.push('sin canónico');
    else if (!apuntaASiMisma(r)) p.push(`canónico ajeno -> ${r.canonical}`);
    if (!r.jsonLd.length) p.push('sin JSON-LD');
    if (r.jsonLdInvalidos) p.push(`${r.jsonLdInvalidos} bloque(s) JSON-LD ilegibles`);
  }
  return p;
}

function imprimir(resultados) {
  for (const r of resultados) {
    const ruta = r.url.replace(/^https?:\/\/[^/]+/, '') || '/';
    const fallas = problemas(r);
    console.log(`${fallas.length ? '[x]' : '[ok]'} ${String(r.status).padEnd(3)} ${ruta}`);
    if (r.title) console.log(`      título    ${r.title}`);
    if (r.canonical) console.log(`      canónico  ${r.canonical}`);
    if (r.robots) console.log(`      robots    ${r.robots}`);
    if (r.tiposJsonLd?.length) console.log(`      json-ld   ${r.tiposJsonLd.join(', ')}`);
    for (const f of fallas) console.log(`      ! ${f}`);
  }

  const conFallas = resultados.filter((r) => problemas(r).length);
  console.log(`\n${resultados.length} URLs · ${resultados.length - conFallas.length} sin observaciones · ${conFallas.length} con observaciones`);

  // Los recuentos que el plan usa como criterio de aceptación.
  const publicas = resultados.filter((r) => r.status === 200 && !esNoindex(r));
  const resumen = {
    'HTTP 4xx/5xx': resultados.filter((r) => r.status >= 400).length,
    'redirecciones': resultados.filter((r) => r.status >= 300 && r.status < 400).length,
    'noindex declarado': resultados.filter((r) => r.status === 200 && esNoindex(r)).length,
    'canónico ajeno (públicas)': publicas.filter((r) => r.canonical && !apuntaASiMisma(r)).length,
    'sin canónico (públicas)': publicas.filter((r) => !r.canonical).length,
    'sin JSON-LD (públicas)': publicas.filter((r) => !r.jsonLd?.length).length,
    'sin meta description (públicas)': publicas.filter((r) => !r.description).length,
  };
  for (const [k, v] of Object.entries(resumen)) console.log(`  ${String(v).padStart(3)}  ${k}`);
}

function comparar(actual, rutaAnterior) {
  const prev = JSON.parse(readFileSync(rutaAnterior, 'utf8'));
  const antes = new Map((prev.resultados || prev).map((r) => [normalizar(r.url), r]));
  console.log(`\n--- diferencias contra ${rutaAnterior} ---`);
  let cambios = 0;
  for (const r of actual) {
    const a = antes.get(normalizar(r.url));
    if (!a) {
      console.log(`+ nueva      ${r.url} (${r.status})`);
      cambios++;
      continue;
    }
    for (const campo of ['status', 'title', 'canonical', 'robots']) {
      if (String(a[campo] ?? '') !== String(r[campo] ?? '')) {
        console.log(`~ ${campo.padEnd(10)} ${r.url}\n    antes: ${a[campo] ?? '—'}\n    ahora: ${r[campo] ?? '—'}`);
        cambios++;
      }
    }
  }
  const ahora = new Set(actual.map((r) => normalizar(r.url)));
  for (const u of antes.keys()) if (!ahora.has(u)) { console.log(`- desapareció ${u}`); cambios++; }
  if (!cambios) console.log('sin cambios');
}

// --- main -------------------------------------------------------------------

let urls = readFileSync(archivo, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

if (baseNueva) {
  const b = baseNueva.replace(/\/+$/, '');
  urls = urls.map((u) => u.replace(/^https?:\/\/[^/]+/, b));
}

const resultados = await enTanda(urls, CONCURRENCIA, revisar);

if (comoJson || salida) {
  const doc = JSON.stringify(
    { generadoEn: new Date().toISOString(), origen: archivo, total: urls.length, resultados },
    null,
    2
  );
  if (salida) {
    writeFileSync(salida, doc, 'utf8');
    console.error(`escrito ${salida}`);
  } else {
    console.log(doc);
  }
} else {
  imprimir(resultados);
}

if (anterior) comparar(resultados, anterior);

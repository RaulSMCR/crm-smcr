// src/app/og/route.js
//
// Genera la imagen de vista previa social (1200×630) en el momento en que una
// red la pide.
//
// Antes, `og:image` y `twitter:image` apuntaban a `/og-image.png`, un archivo
// que no existía: cada vez que alguien compartía cualquier página del sitio en
// WhatsApp, Instagram, Facebook o LinkedIn, la vista previa salía rota.
//
// Se genera en vez de guardarse como archivo fijo porque así cada artículo se
// comparte con su propio título legible, que es el espacio donde se decide si
// alguien abre el enlace o sigue de largo. Un PNG único para quince artículos
// desperdicia ese espacio.
//
// La ruta vive en `/og` y no bajo `/api/` a propósito: el robots.txt bloquea
// `/api/`, y algunos rastreadores sociales respetan robots.txt al buscar la
// imagen. Una vista previa bloqueada por robots es la misma vista previa rota
// que esto viene a arreglar.

import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';

// Cacheable y estable: la misma consulta devuelve siempre la misma imagen.
export const revalidate = 86400;

const MARCA = 'Salud Mental Costa Rica';

// Paleta de marca, en hex porque satori no resuelve variables CSS.
const FONDO = '#0C2223';      // brand-950
const TEAL = '#38868A';       // brand-500
const CORAL = '#FB7A62';      // accent-600
const TEXTO = '#F4FAFA';
const TENUE = '#A8D6D8';      // brand-200

// El logo se lee del disco una sola vez por instancia y se pasa como data URI.
// Si por lo que sea no se puede leer, la tarjeta se compone igual sin él: una
// imagen sin logo sigue siendo mejor que un 404.
let logoDataUri = null;
try {
  const svg = readFileSync(join(process.cwd(), 'public', 'logo.svg'));
  logoDataUri = `data:image/svg+xml;base64,${svg.toString('base64')}`;
} catch {
  logoDataUri = null;
}

/** Recorta respetando palabras, para que el título no quede partido a la mitad. */
function recortar(texto, max) {
  const t = String(texto || '').trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espacio = corte.lastIndexOf(' ');
  return `${(espacio > max * 0.6 ? corte.slice(0, espacio) : corte).trim()}…`;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const titulo = recortar(searchParams.get('t') || MARCA, 110);
  const bajada = recortar(searchParams.get('s') || '', 80);
  // El título largo necesita bajar de cuerpo o desborda la caja.
  const cuerpo = titulo.length > 78 ? 52 : titulo.length > 46 ? 62 : 74;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: FONDO,
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Encabezado: logo y nombre de la plataforma */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {logoDataUri ? (
            <img src={logoDataUri} width={72} height={72} style={{ borderRadius: 16 }} />
          ) : null}
          <div
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: TENUE,
              fontWeight: 600,
            }}
          >
            {MARCA}
          </div>
        </div>

        {/* Título de la página */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: cuerpo,
              lineHeight: 1.15,
              color: TEXTO,
              fontWeight: 600,
              letterSpacing: -1,
            }}
          >
            {titulo}
          </div>

          {/* Regla coral: el acento de marca, y lo que separa título de bajada */}
          <div style={{ display: 'flex', marginTop: 32, height: 6, width: 128, backgroundColor: CORAL }} />

          {bajada ? (
            <div style={{ marginTop: 24, fontSize: 30, color: TENUE, fontWeight: 400 }}>{bajada}</div>
          ) : null}
        </div>

        {/* Pie */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 26, color: TEAL, fontWeight: 500 }}>saludmentalcostarica.com</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'cache-control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    }
  );
}

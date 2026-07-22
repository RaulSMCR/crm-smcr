# Generador de carruseles (slides de Instagram)

Renderiza carruseles PNG 1080×1080 con la paleta de marca (teal/coral/crema) a partir
de una spec JSON, y los sube a Supabase Storage. Convive con Next.js como **Vercel
Python Function** en `api/*.py` (top-level, no `app/api`).

## Arquitectura

- **Next route (Node)** = orquestador: auth de admin, Prisma, registra el carrusel,
  llama a la función Python con un secret interno, guarda los paths. *(CC-3/CC-4)*
- **Python function** (`api/slides/generate.py`) = solo render + upload a Storage.
  Sin Prisma, sin sesiones de usuario; solo verifica el secret interno.

```
api/slides/
├── generate.py          # Vercel Python Function (POST /api/slides/generate)
├── requirements.txt     # Pillow, numpy, requests
├── _lib/
│   └── renderer.py      # render_carousel(spec) -> [(filename, png_bytes), ...]
└── _assets/
    └── fonts/           # Poppins Regular/Medium/Bold/Light (OFL)
```

Los directorios con prefijo `_` no se enrutan como funciones en Vercel; viajan en el
bundle vía `functions.includeFiles` en `vercel.json`.

## Endpoint

`POST /api/slides/generate`

- Header `x-internal-secret: <SLIDES_INTERNAL_SECRET>` (obligatorio).
- Body: `{ "slug": "mi-carrusel", "spec": { "slides": [ ... ] } }`
- Respuestas:
  - `200` `{ "assets": [{ "index", "filename", "storagePath", "width": 1080, "height": 1080 }] }`
  - `400` JSON inválido · `401` secret ausente/incorrecto · `422` slug/spec inválido · `500` error interno/upload.

El `slug` se valida contra `^[a-z0-9][a-z0-9_-]{0,79}$` (previene path traversal en Storage).

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `SLIDES_INTERNAL_SECRET` | Secret compartido Node ↔ Python. Requerido. |
| `SUPABASE_SERVICE_ROLE_KEY` | Bearer para subir/descargar de Storage. **SECRETO**, nunca al cliente. |
| `SUPABASE_URL` | URL base de Supabase. Si falta, se usa `NEXT_PUBLIC_SUPABASE_URL`. |
| `ANTHROPIC_API_KEY` | Redacción asistida (pestaña "Desde artículo"). **SECRETO**. Opcional: sin ella el resto funciona. |
| `ANTHROPIC_MODEL` | Modelo de la propuesta. Default `claude-opus-4-8`; usar `claude-sonnet-4-6` para bajar costo. |

## Endpoints del panel (orquestador Node)

- `POST/GET /api/admin/carousels` — crear (DRAFT) / listar.
- `GET/PATCH /api/admin/carousels/[id]` — detalle + URLs firmadas / editar spec (→DRAFT) o estado.
- `POST /api/admin/carousels/[id]/generate` — llama a la función Python, upserta assets, →GENERATED.
- `GET /api/admin/carousels/[id]/download` — ZIP de los PNG (sin dependencias, `src/lib/zip.js`).
- `POST /api/admin/carousels/draft` — (CC-5) artículo → spec vía Anthropic, validada con zod.
- `POST/GET /api/admin/carousels/images` — (CC-6) upload (jpg/png, ≤8MB, ≥1080px) / galería.

UI en `/panel/admin/carousels` (lista · nuevo con pestaña "Desde artículo" · detalle con editor,
previews, ZIP, aprobar/publicar y galería de imágenes con toggle duotono).

Cargar estas vars en el proyecto de Vercel **antes** del primer deploy de esta fase.

## Buckets de Storage (privados)

Crear una sola vez en la base de Supabase (SQL Editor). Ambos **privados**: el acceso de
lectura será siempre por URL firmada generada server-side.

```sql
-- Bucket de salida: PNGs generados de cada carrusel ({slug}/{filename}.png)
insert into storage.buckets (id, name, public)
values ('carousels', 'carousels', false)
on conflict (id) do nothing;

-- Bucket de entrada: fotos que las specs referencian como
-- "storage:carousel-images/<path>" (cover/narrative en duotono)
insert into storage.buckets (id, name, public)
values ('carousel-images', 'carousel-images', false)
on conflict (id) do nothing;
```

### RLS / acceso

No se crean policies para `anon` ni `authenticated` sobre estos buckets: sin policy, el
acceso queda denegado por defecto para clientes públicos. Todas las operaciones
(subida de PNGs, descarga para preview, generación de URLs firmadas) pasan por el
`service_role`, que **omite RLS** y solo vive server-side (route Node y función Python).

Verificación rápida de que un bucket queda inaccesible sin firmar:

```
GET {SUPABASE_URL}/storage/v1/object/public/carousels/<slug>/slide_01_cover.png  -> 400/404
```

La lectura válida es siempre vía `createSignedUrl` (1 h) desde el servidor.

## Pruebas locales

```bash
python scripts/test-renderer.py     # humo del renderer (CC-1): 3 PNGs 1080x1080
python scripts/test-generate.py     # humo del handler (CC-2): 200/401/422 con upload mock
```

El humo del handler mockea el upload para no depender de los buckets reales. La subida
efectiva requiere los buckets creados y las env vars cargadas.

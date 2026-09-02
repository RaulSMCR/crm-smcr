# Auditoría SEO / GEO — crm-smcr

Diagnóstico de solo lectura. No se modificó ningún archivo del proyecto salvo
este documento. Fecha del relevamiento: 2026-08-19.

**Base del relevamiento**
- Código en `src/`, `prisma/schema.prisma`, `next.config.mjs`, `vercel.json`.
- Consulta de solo lectura a la base de producción (`.env.local`) para el
  inventario de contenido.
- Artefactos del último build en `.next/` (build del 2026-08-15) para verificar
  empíricamente qué se prerenderiza y qué metadatos salen realmente en el HTML.

Aclaración de nomenclatura: el proyecto no usa TypeScript. Todos los archivos
del App Router son `page.js` / `route.js` / `layout.js`, no `.tsx`.

---

## 1. Rutas y renderizado

### 1.1 Páginas públicas

| Ruta pública | Archivo | Modo | Dónde se determina |
|---|---|---|---|
| `/` | `src/app/page.js` | ISR 300 s (prerenderizada en build) | `src/app/page.js:32` (`export const revalidate = 300`); confirmado en `.next/prerender-manifest.json` → `/` con `initialRevalidateSeconds: 300` |
| `/blog` | `src/app/blog/page.js` | SSR en cada request | `src/app/blog/page.js:30` declara `revalidate = 300`, pero `src/app/blog/page.js:33` hace `await searchParams`, lo que fuerza render dinámico. No aparece en `prerender-manifest.json` |
| `/blog/[slug]` | `src/app/blog/[slug]/page.js` | SSR bajo demanda + caché ISR 3600 s | `src/app/blog/[slug]/page.js:8`. **No hay `generateStaticParams`**; `dynamicRoutes` del `prerender-manifest.json` está vacío ⇒ ningún artículo se prerenderiza en build |
| `/blog/serie/[slug]` | `src/app/blog/serie/[slug]/page.js` | SSR bajo demanda + caché ISR 300 s | `src/app/blog/serie/[slug]/page.js:9`. Sin `generateStaticParams` |
| `/blog/preview/[id]` | `src/app/blog/preview/[id]/page.js` | SSR, sin caché, con sesión obligatoria | `src/app/blog/preview/[id]/page.js:7-8` (`dynamic = "force-dynamic"`, `revalidate = 0`) y `:11-12` (`redirect("/ingresar")` si no hay sesión) |
| `/servicios` | `src/app/servicios/page.js` | ISR 300 s (prerenderizada en build) | `src/app/servicios/page.js:69`; confirmado en `prerender-manifest.json` |
| `/servicios/[id]` | `src/app/servicios/[id]/page.js` | SSR bajo demanda + caché ISR 3600 s | `src/app/servicios/[id]/page.js:12`. Sin `generateStaticParams` |
| `/profesionales/[slug]` | `src/app/profesionales/[slug]/page.js` | SSR bajo demanda + caché ISR 3600 s | `src/app/profesionales/[slug]/page.js:11`. Sin `generateStaticParams`. Además lee `searchParams` (`:106`), lo que lo vuelve dinámico de hecho |
| `/nosotros` | `src/app/nosotros/page.js` | SSR en cada request | `src/app/nosotros/page.js:19` (`dynamic = 'force-dynamic'`) |
| `/contacto` | `src/app/contacto/page.js` | SSR en cada request | `src/app/contacto/page.js:18` (`await getSession()` lee cookies) |
| `/faq` | `src/app/faq/page.js` | Estática | Sin `revalidate`/`dynamic`; `prerender-manifest.json` → `/faq` con `revalidate: false` |
| `/terminos` | `src/app/terminos/page.js` | Estática | Ídem manifest |
| `/privacidad` | `src/app/privacidad/page.js` | Estática | Ídem manifest |
| `/cookies` | `src/app/cookies/page.js` | Estática | Ídem manifest |
| `/agendar/[id]` | `src/app/agendar/[id]/page.js` | SSR en cada request | Sin `revalidate` ni `generateStaticParams`; lee `searchParams` (`src/app/agendar/[id]/page.js:50`) |
| `/registro` | `src/app/registro/page.js` | Estática, **client-side** | `src/app/registro/page.js:1` (`"use client"`) |
| `/registro/usuario` | `src/app/registro/usuario/page.js` | Estática, **client-side** | `"use client"` en línea 1 |
| `/registro/profesional` | `src/app/registro/profesional/page.js` | Estática, **client-side** | `"use client"` en línea 1 |
| `/ingresar` | `src/app/ingresar/page.js` | Estática, contenido en cliente | `src/app/ingresar/page.js:1-15` envuelve `LoginClient` (`src/app/ingresar/LoginClient.js:1`, `"use client"`) en `<Suspense>` |
| `/recuperar` | `src/app/recuperar/page.js` | Estática, **client-side** | `src/app/recuperar/page.js:2` (`"use client"`) |
| `/cambiar-password` | `src/app/cambiar-password/page.js` | Estática, contenido en cliente | `Suspense` + `ResetPasswordClient` (`"use client"`) |
| `/verificar-email` | `src/app/verificar-email/page.js` | Estática (render de servidor con `searchParams`) | Sin directivas; aparece en el manifest como estática |
| `/espera-aprobacion` | `src/app/espera-aprobacion/page.js` | Estática | Manifest |
| `/robots.txt` | `src/app/robots.js` | Estática | Manifest → `/robots.txt`, `revalidate: false` |
| `/sitemap.xml` | `src/app/sitemap.js` | Estática (generada en build) | Manifest → `/sitemap.xml`, `revalidate: false`. **Se congela en el build** |
| `/mi/manifest.webmanifest` | `src/app/mi/manifest.webmanifest/route.js` | Estática | `:10` (`dynamic = "force-static"`) |

### 1.2 Rutas privadas (todas `force-dynamic`, tras `middleware`)

`/panel` y `/panel/**` (37 páginas: `panel/admin/*`, `panel/profesional/*`,
`panel/paciente/*`, `panel/direccion-clinica/*`) y `/mi/**` (5 páginas). Todas
declaran `export const dynamic = "force-dynamic"` en su cabecera y están
protegidas en `src/middleware.js:37-48`. `robots.js` desautoriza `/panel/`
(`src/app/robots.js:10`), pero **no** `/mi/`.

### 1.3 Route handlers (`route.js`) — 76 en total

Todos bajo `/api/**` salvo `/mi/manifest.webmanifest`. Prácticamente todos
declaran `dynamic = "force-dynamic"` y `revalidate = 0`. Listado por prefijo:

- `/api/admin/**` (29): carousels, dashboard, editorial, fiscal-export, posts,
  professionals, reconciliation.
- `/api/auth/**` (10): change-password, forgot-password, logout, me,
  resend-verification, reset-password, services, session, verify-email, view-as.
- `/api/blog/**` (3): `[slug]/track`, `[slug]/view`, `events/[id]`.
- `/api/invoices/**` (8), `/api/reports/**` (5), `/api/upload/**` (9),
  `/api/products/**` (2), `/api/cron/**` (2), `/api/mi/push/subscribe`,
  `/api/payment/webhook`, `/api/posts`, `/api/professional/posts/[id]`,
  `/api/leads`, `/api/files`, `/api/categories/tree`, `/api/contact-faq`,
  `/api/reenganche/send`, `/api/reminders/send`.

Ninguno emite HTML indexable; `robots.js:10` desautoriza `/api/`.

### 1.4 Contenido crítico renderizado solo del lado del cliente

**Ninguna página pública depende de fetch del lado del cliente para su contenido
principal.** Todo el contenido editorial (artículos, servicios, perfiles, equipo)
se resuelve en el servidor con Prisma y llega en el HTML.

Matices:

- `src/components/SafeImage.js:1` es `"use client"`, pero renderiza un `<img>`
  en SSR; el `src` sale en el HTML inicial. El fallback (`onError`) sí es solo
  cliente: si la URL de Supabase falla, el crawler ve la URL rota, no el
  reemplazo.
- `src/components/HomeFeatureCarousel.js:1` (`"use client"`) — el carrusel de la
  home. El contenido llega por props desde el servidor (`src/app/page.js:202`),
  así que sí está en el HTML.
- `src/components/PublicHeader.js` es `"use client"` y hace `fetch()` en
  `useEffect` (para el estado de sesión del menú). No afecta contenido indexable.
- Las páginas de registro/login/recuperar sí son 100 % client-side, pero no
  tienen contenido de valor para indexar.

---

## 2. Generación de slugs

### 2.1 No hay *una* función: hay **seis** implementaciones distintas

#### (a) Canónica del proyecto — `src/lib/carousel-spec.js:107-115`

```js
export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // en el archivo, el rango va escrito con los caracteres literales
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
```

Reexportada por `src/lib/blog-taxonomy.js:10` y usada por
`src/actions/taxonomy-actions.js`, `src/app/api/admin/carousels/route.js:66` y
`src/app/api/admin/carousels/[id]/publish-to-blog/route.js:17`.

**Qué hace con acentos:** los descompone (`NFD`) y borra la marca diacrítica
combinante, así que `á → a`, `é → e`, `ó → o`. Correcto.
**Qué hace con la ñ:** `NFD` descompone `ñ` en `n` + U+0303, y el `.replace()`
elimina el U+0303 ⇒ `ñ → n`. Correcto. `mañana → manana`.

#### (b) La que realmente crea los slugs de artículos — `src/actions/admin-actions.js:9-15`

```js
function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
```

Usada en `src/actions/admin-actions.js:151` (editar artículo) y `:247` (crear
artículo desde el panel admin).

**Qué hace con acentos:** **no normaliza**. `á`, `é`, `í`, `ó`, `ú` no están en
`[a-z0-9]`, así que caen en la clase negada y se reemplazan por `-`. `lógicas →
l-gicas`, `introducción → introducci-n`, `qué → qu-`.
**Qué hace con la ñ:** igual — `ñ` se convierte en `-`. `español → espa-ol`,
`niño → ni-o`.

#### (c) API pública de creación de posts — `src/app/api/posts/route.js:9-15`

Copia byte a byte de (b). Mismo defecto. Usada en `:69`.

#### (d) API de edición del profesional — `src/app/api/professional/posts/[id]/route.js:6-12`

Copia byte a byte de (b). Mismo defecto. Usada en `:66`.

#### (e) Vista previa del editor — `src/components/PostEditor.js:15-21`

Copia byte a byte de (b) (defectuosa) — usada en `src/components/PostEditor.js:59`.
En cambio `src/components/admin/AdminPostCreator.js:10-18` **sí** normaliza:

```js
function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
```

por lo que el *preview* del creador admin muestra un slug distinto del que
finalmente se graba.

#### (f) Slug de profesional (registro) — `src/actions/auth-actions.js:301-313`

```js
let slugBase = name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-");
let slug = slugBase || "profesional";
let count = 0;

while (
  await prisma.professionalProfile.findUnique({
    where: { slug: count === 0 ? slug : `${slug}-${count}` },
  })
) {
  count += 1;
}

slug = count === 0 ? slug : `${slug}-${count}`;
```

**Qué hace con acentos y ñ:** `\w` en JavaScript es `[A-Za-z0-9_]` (sin flag
`u` no incluye letras acentuadas). `[^\w\s-]` por lo tanto **borra** el carácter
acentuado en vez de transliterarlo. `Raúl Olmedo → ral-olmedo`.
`Muñoz → muoz`. `Peña → pea`.

También hay una séptima variante, `src/app/panel/admin/marketing/page.js:69-77`,
que normaliza bien pero usa `_` como separador; se usa solo para nombres de
campaña UTM, no para URLs.

### 2.2 Slugs actualmente en base de datos

**Posts — 15 registros, todos `PUBLISHED`:**

| # | slug | ¿corrupto? |
|---|---|---|
| 1 | `del-alma-atribulada-a-la-salud-mental-un-itinerario-geneal-gico-introducci-n` | **sí** (`geneal-gico`, `introducci-n`) |
| 2 | `mundo-encerro-locura-nacimiento-clinica` | no |
| 3 | `siglo-xx-palabra-pastilla-codigo` | no |
| 4 | `oms-consagracion-global-salud-mental-alma-ata` | no |
| 5 | `l-gicas-comunes-m-s-all-de-la-dicotom-a-salud-enfermedad` | **sí** (4 mutilaciones) |
| 6 | `que-es-psicoterapia-y-como-orientarse-entre-escuelas` | no |
| 7 | `qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-2` | **sí** |
| 8 | `qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-3` | **sí** |
| 9 | `qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-4` | **sí** |
| 10 | `autoayuda-pop-y-psic-logo-influencer` | **sí** (`psic-logo`) |
| 11 | `serie-del-alma-atribulada-a-la-salud-mental` | no |
| 12 | `la-salud-mental-despues-de-las-luces` | no |
| 13 | `la-salud-mental-no-cabe-en-una-sola-disciplina` | no |
| 14 | `la-salud-mental-no-cabe-en-una-sola-disciplina-8oyy6` | sufijo aleatorio de colisión |
| 15 | `autoayuda-pop-y-psic-logo-influencer-parte-ii` | **sí** (`psic-logo`) |

7 de 15 (47 %) tienen letras mutiladas. Nótese además el caso 6 vs 7-9: el
mismo título en cuatro partes produjo dos formas distintas (`que-es` /
`qu-es`, `como` / `c-mo`) porque se crearon con rutas de código diferentes.

**Servicios — 10 registros. No tienen campo `slug`.** La URL pública usa el
`id` (cuid) directamente: `src/app/servicios/[id]/page.js` y
`src/app/sitemap.js:50`.

| id (= segmento de URL) | título |
|---|---|
| `cmmfb1tt90000lymtoxo7fk78` | Equipo de acompañamiento terapéutico |
| `cmmfa68vy000010yk575llmbf` | Musicoterapia |
| `cmmf9cuqc0000mzxecgqpvjen` | Nutrición |
| `cmmgucg5p0000foa1v112viik` | Psicoterapia Cognitivo Conductual |
| `cmmfankd80000use0pg1wef0q` | Terapia física y deporte |
| `cmmfasavf0001use0iulti9ac` | Psiquiatría |
| `cmmp2cprz00006t1qitw9asy1` | Psicodiagnóstico |
| `cmmfb2v3p0000dntxz2k98tiv` | Pedagogía |
| `cmm9xo7ux0000f0hps73mpfpt` | Psicoterapia psicoanalítica (adultos) |
| `cmmfb6j0s0001dntxbdtmr0kl` | Terapia de Lenguaje |

**Profesionales — 4 registros:**

| slug | nombre | estado |
|---|---|---|
| `ral-olmedo` | Raúl Olmedo | aprobado, activo — **slug mutilado** (`Raúl → ral`) |
| `andrea-robles` | Andrea Robles | aprobado, activo |
| `mariano-zorrilla` | Mariano Zorrilla | aprobado, **usuario inactivo** |
| `esteban-madrigal` | Esteban Madrigal | aprobado, activo |

**Series, disciplinas y temas: 0 registros en las tres tablas.** La taxonomía
existe en el esquema y en la UI pero está vacía en producción.

### 2.3 Redirects / slug histórico

**No existe ningún mecanismo.** Verificado:

- No hay tabla ni campo de slug histórico en `prisma/schema.prisma` (búsqueda de
  `slugHistory` / `oldSlug` / `previousSlug` / `Redirect`: sin resultados).
- `next.config.mjs` no define `redirects()`, `rewrites()` ni `headers()`.
- `src/middleware.js` solo hace redirects de autenticación (`:146-157`,
  `:186-188`, `:209-213`); no consulta slugs.
- `vercel.json` no tiene bloque `redirects`.

Consecuencia: cambiar el slug de un artículo publicado rompe la URL vieja con un
404, sin 301.

---

## 3. Metadatos

### 3.1 Infraestructura

- `src/lib/seo.js:74-112` — `buildMetadata({ title, description, path, image,
  imageAlt, type, noindex, keywords })` produce `title`, `description`
  (recortada a 160 en `:85`), `alternates.canonical`, `openGraph`
  (title/description/url/type/siteName/images), `twitter` (card/title/
  description/images) y, solo si `noindex`, `robots: { index: false, follow: false }`.
- `src/lib/seo.js:49-66` — `resolveSeo()` aplica el override editorial
  (`metaTitle`/`metaDescription`/`ogImage`/`noindex` de la fila) sobre fallbacks
  del contenido.
- `src/lib/site-url.js:32` — `SITE_URL`, con fallback
  `https://saludmentalcostarica.com` (`:13`).

### 3.2 Layout raíz — `src/app/layout.js:52-87`

Define `metadataBase` (`:53`), `title.default` + `title.template` (`:54-57`),
`description` (`:58`), `keywords` (`:60-68`), `alternates.canonical = BASE_URL`
(`:69`), `openGraph` completo (`:70-79`) y `twitter` (`:80-86`).

### 3.3 Tabla por ruta

| Ruta | Declaración | title | description | canonical | openGraph | robots |
|---|---|---|---|---|---|---|
| `/` | `metadata` = `buildMetadata(...)` — `src/app/page.js:12-17` | propio | propia | propio (`/`) | propio | — |
| `/blog` | `export const metadata` — `src/app/blog/page.js:9-20` | propio | propia | propio (`/blog`) | parcial (title/description/url; **sin `images`**) | — |
| `/blog/[slug]` | `generateMetadata` — `src/app/blog/[slug]/page.js:10-38` | `metaTitle` ‖ `title` | `metaDescription` ‖ `excerpt` ‖ `title` | propio | propio, `type: 'article'` | `noindex` si la fila lo marca (`:36`) |
| `/blog/serie/[slug]` | `generateMetadata` — `:35-44` | propio | `description` de la serie ‖ genérica | propio | **hereda del layout** (queda `og:url` = home) | — |
| `/blog/preview/[id]` | **ninguna** | hereda | hereda | **hereda = home** | hereda | **ninguno** |
| `/servicios` | `export const metadata` — `src/app/servicios/page.js:56-67` | propio | propia | propio | parcial (sin `images`) | — |
| `/servicios/[id]` | `generateMetadata` — `:14-52` | `metaTitle` ‖ `title` | `metaDescription` ‖ `description` | propio | propio | `noindex` si la fila lo marca |
| `/profesionales/[slug]` | `generateMetadata` — `:65-90` | `metaTitle` ‖ `"{nombre} \| Perfil profesional"` | `metaDescription` ‖ `profileReview` ‖ genérica | propio | propio, `type: "profile"` | `noindex` si la fila lo marca |
| `/nosotros` | `export const metadata` — `:6-17` | propio | propia | propio | parcial (sin `images`) | — |
| `/contacto` | `export const metadata` — `:5-15` | propio | propia | propio | parcial (sin `images`) | — |
| `/faq` | `export const metadata` — `:5-9` | propio | propia | **hereda = home** | **hereda = home** | — |
| `/terminos` | `export const metadata` — `:11-15` | propio | propia | **hereda = home** | **hereda = home** | — |
| `/agendar/[id]` | `generateMetadata` — `:9-46` | propio | propia | apunta a `/profesionales/{slug}` (`:38`) | propio | — |
| `/espera-aprobacion` | `export const metadata` — `:3-5` | propio (duplica el sufijo del template) | **ninguna → hereda** | **hereda = home** | hereda | — |
| `/privacidad` | **ninguna** | hereda | hereda | **hereda = home** | hereda | — |
| `/cookies` | **ninguna** | hereda | hereda | **hereda = home** | hereda | — |
| `/registro`, `/registro/usuario`, `/registro/profesional` | **ninguna** (son `"use client"`, no pueden exportar `metadata`) | hereda | hereda | **hereda = home** | hereda | — |
| `/ingresar`, `/recuperar`, `/cambiar-password`, `/verificar-email` | **ninguna** | hereda | hereda | **hereda = home** | hereda | — |
| `/panel/**`, `/mi/**` | 5 páginas de `/mi` y 1 de `/panel/admin` tienen `metadata`; las otras 37 ninguna | — | — | **hereda = home** | hereda | **ninguna declara `noindex`** |

### 3.4 Rutas que heredan metadatos genéricos del layout raíz

Verificado empíricamente en el HTML prerenderizado del último build:

```
.next/server/app/faq.html        → <link rel="canonical" href="https://saludmentalcostarica.com"/>
.next/server/app/cookies.html    → <link rel="canonical" href="https://saludmentalcostarica.com"/>
.next/server/app/privacidad.html → <link rel="canonical" href="https://saludmentalcostarica.com"/>
.next/server/app/terminos.html   → <link rel="canonical" href="https://saludmentalcostarica.com"/>
```

Los cuatro (más `/espera-aprobacion`, `/registro*`, `/ingresar`, `/recuperar`,
`/cambiar-password`, `/verificar-email`, `/blog/preview/[id]`, y las 43 páginas
de `/panel` y `/mi`) declaran a Google que **su URL canónica es la home**. La
causa es `src/app/layout.js:69`: un `alternates.canonical` absoluto en el layout
raíz se hereda por cualquier segmento hijo que no lo redefina.

Lo mismo ocurre con `openGraph.url`: `og:url` = `https://saludmentalcostarica.com`
en `/faq`, `/cookies`, `/privacidad` y `/terminos`.

Nota adicional: `/blog/serie/[slug]` define `alternates` pero **no** `openGraph`,
por lo que hereda el bloque OG entero del layout — incluidos `og:url` = home y
`og:title` genérico.

### 3.5 Meta keywords

**Sí las hay, y se inyectan globalmente.**

Origen único: `src/app/layout.js:60-68`, siete términos hardcodeados
(`salud mental Costa Rica`, `psicología online`, `terapia virtual`,
`coaching bienestar`, `nutrición Costa Rica`,
`profesionales verificados salud mental`, `consulta psicológica`).

Como `keywords` es un campo heredable de Next Metadata y **ninguna** ruta lo
redefine (`src/lib/seo.js:108` solo lo emite si se le pasa el parámetro, y
ninguna llamada a `buildMetadata` en el repo pasa `keywords`), la misma etiqueta
sale idéntica en **todas** las páginas del sitio. Verificado en el HTML:

```html
<meta name="keywords" content="salud mental Costa Rica,psicología online,terapia virtual,coaching bienestar,nutrición Costa Rica,profesionales verificados salud mental,consulta psicológica"/>
```

presente en `faq.html`, `cookies.html`, `privacidad.html`, `terminos.html`,
`servicios.html` e `index.html`.

---

## 4. Datos estructurados

Hay JSON-LD (inyectado por `src/components/JsonLd.js`, un `<script
type="application/ld+json">` con `dangerouslySetInnerHTML`).
**No hay microdata (`itemprop`/`itemscope`/`itemtype`) ni RDFa (`typeof`/`vocab`
en sentido RDFa) en ninguna parte del proyecto.** Las apariciones de `vocab=`
son props de React de `LibraryBar`, no atributos RDFa.

### 4.1 `Organization` — todas las páginas (`src/app/layout.js:24-44`, montado en `:120`)

```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Salud Mental Costa Rica",
  "url": "<SITE_URL>",
  "logo": "<SITE_URL>/logo.svg",
  "description": "Plataforma interdisciplinaria de bienestar y salud mental en Costa Rica. Psicología, nutrición, deporte y más.",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+506-7129-1909",
    "email": "contacto@saludmentalcostarica.com",
    "contactType": "customer service",
    "availableLanguage": "Spanish"
  },
  "sameAs": [
    "https://www.instagram.com/saludmentalcostarica",
    "https://www.facebook.com/saludmentalcostarica",
    "https://www.linkedin.com/company/saludmentalcostarica",
    "https://www.youtube.com/@SMCR506"
  ]
}
```

### 4.2 `MedicalBusiness` — home (`src/app/page.js:199`)

```json
{
  "@context": "https://schema.org",
  "@type": "MedicalBusiness",
  "name": "Salud Mental Costa Rica",
  "url": "<SITE_URL>",
  "medicalSpecialty": "Salud mental"
}
```

### 4.3 `Article` + `BreadcrumbList` — artículo (`src/components/blog/BlogArticleView.js:20-40` y `:46-56`)

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "<post.title>",
  "description": "<post.excerpt | undefined>",
  "image": "<post.coverImage | SITE_URL/og-image.png>",
  "datePublished": "<post.createdAt ISO>",
  "dateModified": "<post.updatedAt ISO>",
  "url": "<SITE_URL>/blog/<slug>",
  "author": {
    "@type": "Person",
    "name": "<authorUser.name>",
    "image": "<authorUser.image | undefined>",
    "jobTitle": "<post.author.specialty | undefined>"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Salud Mental Costa Rica",
    "logo": { "@type": "ImageObject", "url": "<SITE_URL>/logo.svg" }
  }
}
```

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Blog",         "item": "<SITE_URL>/blog" },
    { "@type": "ListItem", "position": 2, "name": "<post.title>", "item": "<SITE_URL>/blog/<slug>" }
  ]
}
```

Se omiten en modo `preview` (`:44`, `:45`).

### 4.4 `FAQPage` — dos instancias distintas

- `/servicios` (`src/app/servicios/page.js:9-54`, montado en `:125`): 4 preguntas
  hardcodeadas sobre consulta virtual, verificación de profesionales, costo y
  disciplinas disponibles. **Estas preguntas no aparecen como texto visible en
  `/servicios`.**
- `/faq` (`src/app/faq/page.js:149-152`, montado en `:155`): se deriva de
  `faqSections`, el mismo contenido que sí se muestra en pantalla.

### 4.5 `Service` + `BreadcrumbList` — detalle de servicio (`src/app/servicios/[id]/page.js:143-144`)

```json
{ "@context": "https://schema.org", "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Servicios",       "item": "<SITE_URL>/servicios" },
    { "@type": "ListItem", "position": 2, "name": "<service.title>", "item": "<SITE_URL>/servicios/<id>" }
  ] }
```

```json
{ "@context": "https://schema.org", "@type": "Service",
  "name": "<service.title>",
  "description": "<service.description | undefined>",
  "offers": { "@type": "Offer", "priceCurrency": "CRC", "price": "<minApprovedPrice>",
              "availability": "https://schema.org/InStock" } }
```

`offers` se omite si no hay precio aprobado.

### 4.6 `Person` + `BreadcrumbList` — perfil público (`src/app/profesionales/[slug]/page.js:110-119` y `:124`)

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "<nombre>",
  "description": "<profileReview | undefined>",
  "image": "<user.image | undefined>",
  "url": "<SITE_URL>/profesionales/<slug>",
  "jobTitle": "<specialty | undefined>",
  "identifier": "<licenseNumber>"
}
```

```json
{ "@context": "https://schema.org", "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Profesionales", "item": "<SITE_URL>/profesionales" },
    { "@type": "ListItem", "position": 2, "name": "<nombre>",      "item": "<SITE_URL>/profesionales/<slug>" }
  ] }
```

### 4.7 `Person` — agendar (`src/app/agendar/[id]/page.js:142`)

Esquema `Person` análogo al anterior.

### 4.8 Lo que NO existe

- No hay `WebSite` con `SearchAction` (sitelinks searchbox).
- No hay `ItemList` en `/blog`, `/servicios` ni `/nosotros`.
- No hay `MedicalWebPage`, `MedicalCondition`, `MedicalTherapy` ni ningún tipo
  de la extensión médica de schema.org más allá de `MedicalBusiness`.
- No hay `Physician` ni `MedicalOrganization` para los perfiles (se usa `Person`
  genérico).
- No hay `about` / `mentions` / `citation` en `Article`.
- No hay `speakable`.
- No hay `@id` en ningún nodo: los grafos no están enlazados entre sí (el
  `Person` del perfil y el `author` del `Article` son nodos independientes sin
  identidad compartida).
- No hay `Breadcrumb` en `/blog` ni en `/blog/serie/[slug]`.

---

## 5. Modelo de datos

### 5.1 `schema.prisma`

El archivo tiene **1727 líneas** y **50 modelos + 23 enums**. Va pegado íntegro
en el [Anexo B](#anexo-b-prismaschemaprisma-completo), al final de este
documento. Acá va el mapa de contenido, con la línea de inicio de cada
declaración:

**Enums:** `Role` (:13), `AppointmentStatus` (:19), `PaymentStatus` (:28),
`PaymentTransactionType` (:35), `PaymentTransactionStatus` (:43),
`ServiceAssignmentStatus` (:52), `LocationModality` (:60), `RateStatus` (:68),
`InsuranceClaimStatus` (:74), `PostStatus` (:80), `InvoiceType` (:86),
`InvoiceStatus` (:93), `FEStatus` (:100), `DocumentType` (:106),
`TaxScope` (:113), `LeadChannel` (:1022), `LeadStatus` (:1028),
`CarouselStatus` (:1097), `TagStatus` (:1228), `SuggestedStatus` (:1234),
`PhrasePickStatus` (:1358), `MessageTargetKind` (:1430), `MessageStatus` (:1435).

**Modelos:** `User` (:123), `ProfessionalProfile` (:244), `Service` (:301),
`Tax` (:343), `Product` (:360), `InvoiceSequence` (:387), `Invoice` (:398),
`InvoiceLine` (:476), `ServiceAssignment` (:506), `Availability` (:544),
`AvailabilityLocation` (:569), `PracticeLocation` (:582),
`ProfessionalTimeBand` (:608), `ProfessionalRate` (:636), `Appointment` (:665),
`PaymentTransaction` (:741), `Settlement` (:796), `SettlementItem` (:821),
`FiscalPeriod` (:837), `Post` (:856), `HomeCarouselItem` (:909),
`InsuranceClaim` (:931), `PostViewEvent` (:953), `RateLimitEntry` (:991),
`UnmatchedPayment` (:1002), `Lead` (:1035), `ChannelSpend` (:1070),
`PushSubscription` (:1085), `Carousel` (:1104), `CarouselAsset` (:1143),
`CarouselVersion` (:1161), `CarouselVersionAsset` (:1185),
`CarouselApprovalEvent` (:1207), `Phase` (:1242), `Discipline` (:1257),
`Topic` (:1272), `TopicComplement` (:1292), `Series` (:1305),
`PostDiscipline` (:1325), `PostTopic` (:1339), `DailyPhrasePick` (:1364),
`PhraseSourceCheck` (:1408), `AdminMessage` (:1440),
`AdminMessageRecipient` (:1488), `ExchangeRate` (:1515),
`AceptacionAcuerdo` (:1545), `ContactoReenganche` (:1567), `Caso` (:1617),
`CasoNota` (:1687), `CasoEvento` (:1710).

### 5.2 `model Post` (`prisma/schema.prisma:856-908`) — campo por campo

| Campo | Tipo | ¿Público? | Dónde |
|---|---|---|---|
| `id` | String @id cuid | no (solo `key` de React y `/blog/preview/[id]`) | — |
| `title` | String | **sí** | `<h1>` en `BlogArticleView.js:83`, `Article.headline` |
| `slug` | String @unique | **sí** (es la URL) | `/blog/[slug]` |
| `content` | String @db.Text | **sí** | `MarkdownRenderer` en `BlogArticleView.js:129` |
| `excerpt` | String? @db.Text | **sí** | listado (`blog/page.js:169`), `Article.description`, meta description |
| `coverImage` | String? | **sí** | `BlogArticleView.js:62`, `Article.image` |
| `coverImageTitle` | String? | **sí** | crédito de obra (`:94`) y `alt` de la portada (`:64`) |
| `coverImageAuthor` | String? | **sí** | crédito de obra (`:94`) |
| `coverImageNote` | String? @db.Text | **sí** | crédito de obra (`:97`) |
| `coverImageFocusX/Y`, `coverImageScale` | Int | sí (como CSS inline) | `:68-69` |
| `status` | PostStatus | no (filtro) | `blog/[slug]/page.js:44` |
| `metaTitle` | String? | sí (en `<title>`) | `blog/[slug]/page.js:15` |
| `metaDescription` | String? @db.Text | sí (en meta) | ídem |
| `ogImage` | String? | sí (en OG) | `seo.js:55` |
| `focusKeyword` | String? | **no** — solo panel `/panel/admin/marketing/seo` | `seo.js:63` |
| `noindex` | Boolean | sí (como `robots`) | `seo.js:109` |
| `authorId` / `author` | rel. `ProfessionalProfile` | sí (indirecto) | ver §7 |
| `seriesId` / `series` | rel. `Series` | sí | `blog/page.js:51`, `ArticleTaxonomy` |
| `seriesOrder` | Int? | sí | `blog/page.js:152` |
| `seriesApproved` | Boolean | no (gate) | `blog/page.js:150` |
| `suggestedStatus` | SuggestedStatus? | **no** — flujo editorial interno | panel |
| `disciplines` / `topics` | rel. | sí (solo `APPROVED`) | `blog/page.js:53-54` |
| `createdAt` | DateTime | **sí** | `BlogArticleView.js:84`, `Article.datePublished` |
| `updatedAt` | DateTime | sí **solo en JSON-LD** | `Article.dateModified` (`:27`) — no hay texto visible |
| `viewEvents` | rel. `PostViewEvent` | no (analítica interna) | orden `?orden=leidos` |
| `homeCarouselItems` | rel. | no | curaduría de home |

### 5.3 `model ProfessionalProfile` (`prisma/schema.prisma:244-300`) — campo por campo

| Campo | Tipo | ¿Público? | Dónde |
|---|---|---|---|
| `id` | String @id cuid | **sí** (es la URL de `/agendar/[id]`) | `BlogArticleView.js:119` |
| `userId` / `user` | rel. `User` | parcial (ver §5.4) | — |
| `slug` | String @unique | **sí** (URL de `/profesionales/[slug]`) | — |
| `specialty` | String | **sí** | `profesionales/[slug]/page.js:162`, `Person.jobTitle` |
| `licenseNumber` | String? | **sí** | `:165` («Licencia: …»), `Person.identifier` (`:118`), `ProfessionalProfileCard.js:46` («Matrícula profesional») |
| `bio` | String? @db.Text | **no** — se selecciona (`:35`) pero nunca se renderiza en la página pública | — |
| `profileReview` | String? @db.Text | **sí** | `:190`, meta description, `Person.description` |
| `profileReviewDraft` | String? @db.Text | no | panel |
| `profileReviewStatus` | String | no | panel |
| `profileReviewSubmittedAt` / `ReviewedAt` / `AdminNote` | — | no | panel |
| `coverLetter` | String? @db.Text | no | panel admin |
| `cvUrl` | String? | no | panel admin |
| `introVideoUrl` | String? | **no** — no se renderiza en ninguna vista pública | — |
| `avatarUrl` | String? | parcial — solo como `og:image` en `/agendar/[id]` (`:31`); la foto visible sale de `user.image` | — |
| `calendarUrl` | String? | no | — |
| `googleRefreshToken` | String? @db.Text | no (secreto) | — |
| `metaTitle`, `metaDescription`, `ogImage` | String? | sí (en metadatos) | `:38-40` |
| `focusKeyword` | String? | no | panel SEO |
| `noindex` | Boolean | sí (como `robots`) | `:41` |
| `isApproved` | Boolean | no (gate) | `:27` |
| `rating` | Decimal? @db.Decimal(2,1) | **no** — se selecciona (`:37`) pero **nunca se renderiza ni se emite como `AggregateRating`** | — |
| `commission` | Int | no (interno) | — |
| relaciones (`serviceAssignments`, `posts`, `practiceLocations`, `timeBands`, `appointments`, `invoices`, `casos`, `settlements`, …) | — | `serviceAssignments` y `posts` sí; el resto no | `:43-60` |
| `createdAt` / `updatedAt` | DateTime | `updatedAt` solo alimenta `lastModified` del sitemap (`sitemap.js:37`) | — |

### 5.4 `model User` (`prisma/schema.prisma:123-243`) — qué se expone

De los ~60 campos del modelo, **solo dos llegan al frontend público**:

- `name` — nombre visible del profesional y del autor del artículo.
- `image` — avatar.

Un tercero, `isActive`, se usa como filtro (`src/app/page.js:74`,
`profesionales/[slug]/page.js:28`), no se renderiza.

**Todo lo demás es privado y no aparece en ninguna vista pública:** `email`,
`passwordHash`, `sessionVersion`, `phone`, `role`, `identification`,
`birthDate`, `gender`, `interests`, `emailVerified`, `lastLogin`, atribución de
marketing (`acquisitionChannel`, `campaignName`, `utmSource/Medium/Campaign/
Term/Content`, `referrer`, `landingPath`), tokens (`verifyTokenHash`,
`verifyTokenExp`, `resetTokenHash`, `resetTokenExp`), seguro médico
(`hasInsurance`, `useInsuranceForPayment`, `insuranceName`, formularios), datos
de facturación (`billingName`, `billingIdType`, `billingIdNumber`,
`billingEmail`), bloqueo de agenda (`schedulingBlockedAt`,
`schedulingBlockedReason`, `schedulingRestoredAt`), acuerdo (`acuerdoVersion`,
`acuerdoAceptadoAt`, `acuerdoPendienteDesde`, `acuerdoPendienteMotivo`) y
dirección clínica (`clinicalDirectorSince`, `colegiadoNumero`,
`colegiadoColegio`).

### 5.5 Credencial profesional, colegiatura, verificación y URIs semánticas externas

**Campos que existen:**

| Campo | Modelo | Línea | Uso público |
|---|---|---|---|
| `licenseNumber` | `ProfessionalProfile` | `:257` | **sí** — texto «Licencia: N» y `Person.identifier` |
| `cvUrl` | `ProfessionalProfile` | `:262` | no |
| `isApproved` | `ProfessionalProfile` | `:283` | no — solo filtra |
| `rating` | `ProfessionalProfile` | `:285` | no — nunca se renderiza |
| `colegiadoNumero` | `User` | `:196` | **no** — es del director clínico, no del profesional; solo alimenta `requireClinicalDirector` |
| `colegiadoColegio` | `User` | `:197` | no |
| `clinicalDirectorSince` | `User` | `:195` | no |

**Lo que NO existe en el modelo de datos:**

- No hay campo de **colegio profesional** (CPPCR u otro) en
  `ProfessionalProfile`. El número de matrícula existe sin autoridad emisora:
  `licenseNumber: "8270"` no dice de qué registro es.
- No hay **fecha de verificación** ni **quién verificó**: `isApproved` es un
  booleano sin traza.
- No hay **estado de vigencia de la colegiatura** ni fecha de vencimiento.
- No hay **ningún campo de URI semántica externa**: ni ORCID, ni Wikidata, ni
  `sameAs` por profesional, ni LinkedIn, ni perfil en el colegio, ni DOI. El
  único `sameAs` del proyecto es el de la organización
  (`src/app/layout.js:38-43`) y está hardcodeado.
- No hay campos de **títulos académicos**, universidad, año de graduación,
  especializaciones ni idiomas de atención.
- No hay campo de **área geográfica de atención** en el perfil (existe
  `PracticeLocation` para agenda, pero no se expone en la página pública).

---

## 6. Archivos de indexación

### 6.1 Sitemap — `src/app/sitemap.js` (existe, generado)

Código completo:

```js
import { prisma } from '@/lib/prisma';
import { SITE_URL as BASE_URL } from '@/lib/site-url';

const STATIC_PAGES = [
  { url: '/',                      priority: 1.0, changeFrequency: 'weekly'  },
  { url: '/servicios',             priority: 0.9, changeFrequency: 'weekly'  },
  { url: '/blog',                  priority: 0.8, changeFrequency: 'daily'   },
  { url: '/nosotros',              priority: 0.6, changeFrequency: 'monthly' },
  { url: '/faq',                   priority: 0.7, changeFrequency: 'monthly' },
  { url: '/registro',              priority: 0.6, changeFrequency: 'monthly' },
  { url: '/registro/profesional',  priority: 0.6, changeFrequency: 'monthly' },
  { url: '/terminos',              priority: 0.6, changeFrequency: 'yearly'  },
  { url: '/privacidad',            priority: 0.6, changeFrequency: 'yearly'  },
  { url: '/cookies',               priority: 0.6, changeFrequency: 'yearly'  },
];

export default async function sitemap() {
  const now = new Date();

  const staticEntries = STATIC_PAGES.map(({ url, priority, changeFrequency }) => ({
    url: `${BASE_URL}${url}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  let services = [], professionals = [], posts = [];

  try {
    [services, professionals, posts] = await Promise.all([
      prisma.service.findMany({
        where: { isActive: true, noindex: false },
        select: { id: true, updatedAt: true },
      }),
      prisma.professionalProfile.findMany({
        where: { isApproved: true, noindex: false },
        select: { id: true, slug: true, updatedAt: true },
      }),
      prisma.post.findMany({
        where: { status: 'PUBLISHED', noindex: false },
        select: { slug: true, updatedAt: true },
      }),
    ]);
  } catch {
    // Si la DB no está disponible en build time, retornamos solo las páginas estáticas
  }

  const serviceEntries = services.map(({ id, updatedAt }) => ({
    url: `${BASE_URL}/servicios/${id}`,
    lastModified: updatedAt,
    changeFrequency: 'weekly',
    priority: 0.9,
  }));

  const professionalEntries = professionals.filter(({ slug }) => slug).map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/profesionales/${slug}`,
    lastModified: updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const postEntries = posts.map(({ slug, updatedAt }) => ({
    url: `${BASE_URL}/blog/${slug}`,
    lastModified: updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...serviceEntries, ...professionalEntries, ...postEntries];
}
```

Observaciones:

- `.next/prerender-manifest.json` lo marca con `revalidate: false` ⇒ **se genera
  una sola vez en el build y no se refresca**. Un artículo publicado después del
  último deploy no entra al sitemap hasta el siguiente build.
- No incluye `/contacto`, ni `/registro/usuario`, ni `/blog/serie/[slug]`.
- El `catch` silencioso (`:44-46`) hace que, si la base no responde en build
  time, el sitemap salga con 10 URLs estáticas y **sin ningún artículo**, sin
  aviso.
- Filtra profesionales por `isApproved` pero **no** por `user.isActive`, de modo
  que `mariano-zorrilla` (usuario inactivo) entra al sitemap aunque
  `/profesionales/mariano-zorrilla` responde 404
  (`profesionales/[slug]/page.js:28` exige `user.isActive`).

### 6.2 robots.txt — `src/app/robots.js` (existe, generado)

Código completo:

```js
import { SITE_URL, siteUrl } from '@/lib/site-url';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // `/registro*` queda indexable a propósito: son las páginas de captación
      // y el sitemap las publica. `/panel/` es el área privada real.
      disallow: ['/api/', '/panel/', '/ingresar'],
    },
    sitemap: siteUrl('sitemap.xml'),
    host: SITE_URL,
  };
}
```

Salida efectiva:

```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /panel/
Disallow: /ingresar

Host: https://saludmentalcostarica.com
Sitemap: https://saludmentalcostarica.com/sitemap.xml
```

No cubre `/mi/` (PWA de pacientes), ni `/blog/preview/`, ni `/agendar/`, ni
`/cambiar-password`, ni `/recuperar`, ni `/verificar-email`.

### 6.3 Bloqueo de crawlers de IA

**No hay ningún bloqueo, ni explícito ni implícito.** Búsqueda de `GPTBot`,
`ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`, `anthropic-ai`,
`noai`, `X-Robots-Tag` en `src/`, `public/`, `next.config.mjs` y `vercel.json`:
sin resultados (la única coincidencia de «anthropic» es el import del SDK en
`src/app/api/admin/carousels/draft/route.js:4`).

`src/app/robots.js` define un solo bloque `User-Agent: *` con `Allow: /`, así
que todos los crawlers de IA tienen acceso a todo lo que no esté en el
`disallow`. No hay `<meta name="robots">` global ni cabecera `X-Robots-Tag` en
`next.config.mjs` (que no define `headers()`).

Tampoco hay archivo `llms.txt` ni equivalente.

---

## 7. Autoría y fechas

### 7.1 Asociación post → autor

`Post.authorId` → `ProfessionalProfile.id`
(`prisma/schema.prisma:879-880`, con `onDelete: Cascade`). El nombre visible
viene de `ProfessionalProfile.user.name`.

Un post **siempre** tiene autor: `authorId` es `String` no opcional. No hay
soporte de coautoría ni de autor externo no profesional (el fallback
`"Redacción"` de `blog/page.js:180` y `serie/[slug]/page.js:91` es defensivo, no
un caso real del modelo).

### 7.2 ¿Hay página de autor?

**Hay una página de perfil, pero no está enlazada desde el artículo, y el
listado de artículos por autor es solo un query param.**

- Existe `/profesionales/[slug]` (`src/app/profesionales/[slug]/page.js`), que
  sí muestra los 3 artículos más recientes del profesional (`:55-60`, render en
  `:225-243`).
- **Pero desde el artículo no se llega a ella.** La tarjeta de autor de
  `BlogArticleView.js:117-124` etiqueta el botón como «Ver Perfil» y enlaza a
  `/agendar/${post.author.id}` — la página de reserva, no el perfil. La página
  del artículo **no contiene ningún enlace a `/profesionales/[slug]`**.
- El listado completo por autor es un filtro por query param:
  `/blog?autor=<slug>` (`src/lib/blog-taxonomy.js:41`,
  `where.author = { slug: params.autor }`). Enlazado solo desde
  `src/components/ProfessionalProfileCard.js:85` («Ver artículos publicados»),
  es decir desde `/nosotros`.
- `/blog?autor=…` **no tiene URL canónica propia**: `src/app/blog/page.js:13`
  fija `canonical: siteUrl('blog')` de forma estática para cualquier
  combinación de filtros. Ninguna vista filtrada (autor, disciplina, tema,
  serie, búsqueda, orden) es indexable como página independiente.
- No existe la ruta `/profesionales` (índice). El `BreadcrumbList` de
  `profesionales/[slug]/page.js:124` y el de `agendar/[id]/page.js` apuntan a
  `<SITE_URL>/profesionales`, que **devuelve 404**. El índice real del equipo
  vive en `/nosotros`.

### 7.3 Fechas en el HTML

| Dato | ¿En el HTML? | Dónde |
|---|---|---|
| Fecha de publicación, artículo | **sí, pero como texto plano** | `BlogArticleView.js:84`: `<p className="…">{formatDate(post.createdAt)}</p>`. **No es un `<time>` y no tiene `dateTime`** |
| Fecha de publicación, listado `/blog` | **sí, con `<time dateTime>`** | `src/app/blog/page.js:147` |
| Fecha de publicación, `/blog/serie/[slug]` | sí, texto plano | `:91` |
| Fecha de última actualización | **solo en JSON-LD** | `BlogArticleView.js:27` (`dateModified`). **No aparece en ninguna parte visible de la página** |

El `Article` JSON-LD sí lleva `datePublished` y `dateModified` en ISO
(`:26-27`), tomados de `createdAt` y `updatedAt`. Nótese que `updatedAt` se toca
en cualquier `prisma.post.update`, incluidos cambios que no son editoriales, así
que `dateModified` puede moverse sin que el contenido haya cambiado.

Formato de fecha visible: `Intl.DateTimeFormat("es-AR", …)` en
`BlogArticleView.js:9`; `"es-ES"` en `blog/page.js:23` y
`serie/[slug]/page.js:12`. Tres locales distintos, ninguno `es-CR`.

---

## 8. Imágenes

### 8.1 Cómo se sirven

**Ninguna imagen del sitio pasa por `next/image`.** Búsqueda de `next/image` en
`src/`: la única coincidencia es `src/middleware.js:219`, dentro del `matcher`
regex. No hay ningún `import Image from "next/image"` en el proyecto.

Todo se sirve con `<img>` crudo a través de dos componentes:

- `src/components/SafeImage.js:18-53` — `SafeImage`, un `"use client"` que
  renderiza `<img>` (`:38-51`) con un `onError` que cae a `fallbackSrc`.
- `src/components/SafeImage.js:55-88` — `SafeAvatar`, ídem para avatares, con
  fallback a un `<div>` con iniciales (`:70-77`).

Las URLs se normalizan en `src/lib/images.js:50-81` (`normalizeImageSrc`), que
para valores tipo `post-covers/<id>/<archivo>` construye
`{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`
(`src/lib/images.js:30-48`).

Consecuencias directas: no hay `srcset`/`sizes` efectivo (el `sizes` que pasa
`blog/page.js:136` a un `<img>` sin `srcset` es inerte), no hay conversión a
AVIF/WebP, no hay `width`/`height` declarados (⇒ CLS), no hay `loading="lazy"`
explícito ni `fetchpriority` en el LCP. El bloque `images.remotePatterns` de
`next.config.mjs:8-15` está configurado pero **no lo usa nadie**.

Portadas de post y banners de servicio viven en Supabase Storage (buckets
`post-covers`, `service-banners`); los avatares en `avatars`. Los tres deben ser
públicos para que la URL resuelva (`src/lib/images.js:17`).

### 8.2 Alt text — de dónde sale

| Imagen | `alt` | Archivo:línea |
|---|---|---|
| Portada, listado `/blog` | `` `Portada: ${p.title}` `` | `src/app/blog/page.js:129` |
| Portada, artículo (hero) | `post.coverImageTitle \|\| post.title` | `src/components/blog/BlogArticleView.js:64` |
| Portada, `/blog/serie/[slug]` | `""` (vacío, decorativa) | `src/app/blog/serie/[slug]/page.js:80` |
| Portada, carrusel de home | `article?.title \|\| "Artículo"` | `src/components/HomeFeatureCarousel.js:58` |
| Banner, `/servicios` | `service.title` | `src/app/servicios/page.js:161` |
| Banner, `/servicios/[id]` | `service.title` | `src/app/servicios/[id]/page.js:160` |
| Categoría, home | `category.name` / `name \|\| "Categoría"` | `src/components/CategorySection.js:32`, `src/components/CategoryCard.js:22` |
| Avatar, listado `/blog` | `""` explícito (decorativo) | `src/app/blog/page.js:174` |
| Avatar, carrusel home | `""` explícito | `src/components/HomeFeatureCarousel.js:90` |
| Avatar (resto) | `alt \|\| name \|\| ""` — cae al nombre de la persona | `src/components/SafeImage.js:83` |
| Fallback de `SafeImage` sin `alt` | `""` (default del parámetro) | `src/components/SafeImage.js:21` |

**Sí hay alt text en todas las imágenes de contenido, derivado del título.**
Nunca sale de un campo dedicado: `Post` no tiene campo `coverImageAlt`;
`coverImageTitle` es el título de la obra artística (crédito), reusado como
`alt` solo en el hero del artículo. `seo.js:56` calcula un `imageAlt` para
Open Graph, pero eso no llega al `<img>`.

### 8.3 Imagen social por defecto

`src/lib/seo.js:22` define `DEFAULT_OG_IMAGE = "/og-image.png"`, y
`src/app/layout.js:78` y `:85` la referencian.
**`public/og-image.png` no existe.** El contenido de `public/` es:
`apple-touch-icon.png`, `brand/`, `favicon-96x96.png`, `favicon.svg`,
`file.svg`, `globe.svg`, `images/` (4 archivos), `logo.svg`, `mi-offline.html`,
`mi-sw.js`, `next.svg`, `site.webmanifest`, `web-app-manifest-192x192.png`,
`web-app-manifest-512x512.png`, `window.svg`.

No hay `opengraph-image.*` ni `twitter-image.*` en `src/app/`.

---

## 9. Inventario de contenido

### 9.1 Posts

- **Total: 15.**
- **Publicados: 15. Borradores (`DRAFT`): 0. Archivados: 0.**
- **Por autor:** los 15 son de **Raúl Olmedo** (`ral-olmedo`). Los otros tres
  profesionales (`andrea-robles`, `mariano-zorrilla`, `esteban-madrigal`) no
  tienen ningún artículo.
- **Por serie:** **ninguno**. La tabla `Series` está vacía (0 filas), y los 15
  posts tienen `seriesId = null`. Los agrupamientos que sugieren los títulos
  («Capítulo 1…4», «Parte 2…4», «I / II») **no están modelados**: son texto
  libre en el título.

**Posts sin excerpt (`excerpt = NULL`) — 2:**

| slug | título |
|---|---|
| `l-gicas-comunes-m-s-all-de-la-dicotom-a-salud-enfermedad` | Lógicas comunes más allá de la dicotomía salud-enfermedad |
| `qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-2` | Qué es psicoterapia y cómo orientarse entre escuelas. Parte 2 |

**Posts con excerpt por debajo del mínimo SEO (70 car., `seo.js:19`) — 0**, pero
dos quedan justo en el borde:

| slug | longitud |
|---|---|
| `qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-3` | 77 |
| `qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-4` | 90 |

Los otros 11 están entre 221 y 388 caracteres — es decir, **por encima del
máximo de 160** que `buildMetadata` aplica (`seo.js:85`), así que la meta
description sale recortada en todos ellos.

**Campos SEO editoriales:**

| Campo | Con valor | Sin valor |
|---|---|---|
| `metaTitle` | 2 / 15 | 13 |
| `metaDescription` | 2 / 15 | 13 |
| `focusKeyword` | 2 / 15 | 13 |
| `noindex = true` | 0 / 15 | — |
| `coverImage` | 15 / 15 | 0 |

Los dos con SEO completo son `autoayuda-pop-y-psic-logo-influencer` y
`autoayuda-pop-y-psic-logo-influencer-parte-ii`.

**Taxonomía:** `Discipline` = 0 filas, `Topic` = 0 filas, `Series` = 0 filas.
Ningún post tiene disciplinas ni temas aprobados. Los filtros de `LibraryBar`
salen vacíos en producción.

### 9.2 Servicios

- **Total: 10.** Los 10 activos (`isActive = true`), ninguno con `noindex`.
- **Estructura de URL:** `/servicios/{cuid}` — el segmento es el `id` de Prisma
  (`@default(cuid())`, `prisma/schema.prisma:302`), no un slug. Ejemplo real:
  `/servicios/cmm9xo7ux0000f0hps73mpfpt` para «Psicoterapia psicoanalítica
  (adultos)».
- Los 10 tienen `bannerImage` y `description` (entre 192 y 739 caracteres).
- **Ninguno tiene `metaTitle` ni `metaDescription`** (0/10), así que el `<title>`
  sale como el título crudo del servicio y la description es la descripción
  recortada a 160.

### 9.3 Profesionales

- **Total: 4**, los 4 con `isApproved = true`, ninguno con `noindex`.
- 3 con usuario activo (`ral-olmedo`, `andrea-robles`, `esteban-madrigal`);
  1 con usuario inactivo (`mariano-zorrilla`).
- URL: `/profesionales/{slug}`.
- **Ninguno tiene `metaTitle` ni `metaDescription`** (0/4).
- Los 4 tienen `licenseNumber` (8270, 11665, 59205, 130032).
- El campo `specialty` es texto libre y está sin normalizar: `"Psicólogo"`,
  `"psicologia clínica"`, `"Psicólogo clínico"`, `"Psicología Clínica"` — cuatro
  grafías para dos conceptos.

---

## 10. Hallazgos

Ordenados por severidad. Sin propuestas de solución.

### Críticos

**H-01 — El canónico de todas las páginas sin `alternates` propio apunta a la home.**
`src/app/layout.js:69` declara `alternates: { canonical: BASE_URL }` en el
layout raíz. Next hereda ese campo en todo segmento hijo que no lo redefina.
Verificado en el HTML del build: `.next/server/app/faq.html`,
`cookies.html`, `privacidad.html` y `terminos.html` emiten
`<link rel="canonical" href="https://saludmentalcostarica.com"/>`. Afecta a
`/faq`, `/terminos`, `/privacidad`, `/cookies`, `/espera-aprobacion`,
`/registro`, `/registro/usuario`, `/registro/profesional`, `/ingresar`,
`/recuperar`, `/cambiar-password`, `/verificar-email`, `/blog/preview/[id]` y
las 43 páginas de `/panel` y `/mi`.

**H-02 — La función que genera los slugs de artículos destruye acentos y ñ.**
`src/actions/admin-actions.js:9-15` (y sus copias en
`src/app/api/posts/route.js:9-15`, `src/app/api/professional/posts/[id]/route.js:6-12`,
`src/components/PostEditor.js:15-21`) no normaliza NFD: `[^a-z0-9]+ → "-"`
convierte `ó` en `-`. Existe una implementación correcta en
`src/lib/carousel-spec.js:107-115`, pero no es la que se usa. Resultado en
producción: 7 de 15 slugs mutilados (`l-gicas-comunes-m-s-all-de-la-dicotom-a-…`,
`introducci-n`, `psic-logo`, `qu-es`, `c-mo`).

**H-03 — El slug de profesional borra los caracteres acentuados en vez de transliterarlos.**
`src/actions/auth-actions.js:301`: `name.replace(/[^\w\s-]/g, "")` — `\w` sin
flag `u` es `[A-Za-z0-9_]`, así que la letra acentuada se elimina. En producción
`Raúl Olmedo` → `/profesionales/ral-olmedo`. Un apellido con `ñ` daría `pea`,
`muoz`.

**H-04 — No existe ningún mecanismo de redirect ni de slug histórico.**
No hay tabla ni campo en `prisma/schema.prisma`; `next.config.mjs` no define
`redirects()`; `src/middleware.js` solo redirige por autenticación;
`vercel.json` no tiene bloque de redirects. Cambiar cualquier slug publicado
produce un 404 sin 301, y no hay forma de arreglar H-02/H-03 sin romper URLs.

**H-05 — La imagen social por defecto no existe.**
`src/lib/seo.js:22` (`DEFAULT_OG_IMAGE = "/og-image.png"`),
`src/app/layout.js:78` y `:85` la referencian, y
`src/components/blog/BlogArticleView.js:25` la usa como fallback de
`Article.image`. `public/og-image.png` no está en el repositorio y no hay
`opengraph-image.*` en `src/app/`. Toda página sin imagen propia comparte en
redes una URL 404.

### Altos

**H-06 — El sitemap se congela en el build.**
`.next/prerender-manifest.json` marca `/sitemap.xml` con `revalidate: false`, y
`src/app/sitemap.js` no exporta `revalidate` ni `dynamic`. Los artículos
publicados después del último deploy no entran hasta el próximo build.

**H-07 — El sitemap puede quedarse sin contenido en silencio.**
`src/app/sitemap.js:44-46`: el `catch {}` vacío hace que un fallo de conexión a
la base durante el build produzca un sitemap con solo las 10 URLs estáticas, sin
ningún artículo, servicio ni profesional, y sin error visible.

**H-08 — El sitemap publica un perfil que devuelve 404.**
`src/app/sitemap.js:35-38` filtra profesionales por `isApproved: true` y
`noindex: false`, pero **no** por `user.isActive`. En cambio
`src/app/profesionales/[slug]/page.js:28` exige `user: { is: { isActive: true } }`.
`mariano-zorrilla` cumple lo primero y no lo segundo: está en el sitemap y
responde 404.

**H-09 — La página del artículo no enlaza al perfil de su autor.**
`src/components/blog/BlogArticleView.js:117-124`: el botón etiquetado «Ver
Perfil» apunta a `/agendar/${post.author.id}`, no a
`/profesionales/${author.slug}`. No hay ningún otro enlace al perfil desde el
artículo. La entidad autor y la entidad artículo no están conectadas por enlace.

**H-10 — La ruta `/profesionales` referenciada en los breadcrumbs no existe.**
`src/app/profesionales/[slug]/page.js:124` y `src/app/agendar/[id]/page.js:142`
emiten un `BreadcrumbList` cuyo `ListItem` de posición 1 apunta a
`siteUrl("profesionales")`. `find src/app -name page.js` confirma que no hay
`src/app/profesionales/page.js`. El índice del equipo está en `/nosotros`.

**H-11 — Ninguna vista filtrada del blog tiene URL canónica propia.**
`src/app/blog/page.js:13` fija `alternates: { canonical: siteUrl('blog') }` de
forma estática. Todas las combinaciones (`?autor=`, `?disciplina=`, `?tema=`,
`?serie=`, `?q=`, `?orden=`) canonicalizan a `/blog`. No existen rutas propias
tipo `/blog/autor/[slug]` ni `/blog/tema/[slug]`.

**H-12 — Ninguna imagen pasa por `next/image`.**
`src/components/SafeImage.js:38` y `:81` renderizan `<img>` crudo. Sin
`width`/`height` (CLS), sin `srcset`, sin lazy loading declarado, sin
optimización de formato. El `sizes="(max-width: 768px) 100vw, …"` de
`src/app/blog/page.js:136` se aplica a un `<img>` sin `srcset` y por lo tanto no
hace nada. `next.config.mjs:8-15` configura `images.remotePatterns` que nadie
usa.

**H-13 — La taxonomía completa está vacía en producción.**
Consulta a la base: `Discipline` 0 filas, `Topic` 0 filas, `Series` 0 filas. La
infraestructura existe (`prisma/schema.prisma:1257`, `:1272`, `:1305`;
`src/lib/blog-taxonomy.js`; `src/components/blog/LibraryBar.js`;
`src/app/blog/serie/[slug]/page.js`), pero no hay ninguna entidad temática
declarada. Los 15 posts tienen `seriesId = null` pese a que sus títulos
declaran «Capítulo 1…4» y «Parte 2…4».

**H-14 — El 87 % de los artículos no tiene metadatos SEO editoriales.**
13 de 15 posts tienen `metaTitle`, `metaDescription` y `focusKeyword` en `NULL`.
0 de 10 servicios y 0 de 4 profesionales tienen `metaTitle`/`metaDescription`.
Los campos existen (`prisma/schema.prisma:871-875` en `Post`, y sus equivalentes
en `Service` y `ProfessionalProfile`) y `src/lib/seo.js:49-66` los respeta;
están sin llenar.

### Medios

**H-15 — Las mismas siete `meta keywords` en todas las páginas del sitio.**
`src/app/layout.js:60-68`. Ninguna ruta redefine el campo, así que se hereda en
todas. Verificado en `faq.html`, `cookies.html`, `privacidad.html`,
`terminos.html`, `servicios.html` e `index.html`.

**H-16 — `og:url` heredado de la home en cuatro páginas y en las series.**
`src/app/layout.js:70-79`. `/faq`, `/terminos`, `/privacidad` y `/cookies`
emiten `<meta property="og:url" content="https://saludmentalcostarica.com"/>`
(verificado en el HTML). `src/app/blog/serie/[slug]/page.js:39-43` define
`title`, `description` y `alternates` pero no `openGraph`, así que hereda el
bloque entero del layout.

**H-17 — Cinco páginas públicas sin ningún metadato propio.**
`src/app/privacidad/page.js` (sin `metadata`), `src/app/cookies/page.js` (sin
`metadata`), y las tres de `src/app/registro/` — estas últimas no pueden
exportar `metadata` porque son `"use client"`
(`src/app/registro/page.js:1`, `registro/usuario/page.js:1`,
`registro/profesional/page.js:1`), y dos de ellas están en el sitemap
(`src/app/sitemap.js:10-11`).

**H-18 — La fecha de publicación del artículo no es marcado semántico.**
`src/components/blog/BlogArticleView.js:84` la imprime como
`<p>{formatDate(post.createdAt)}</p>`, sin `<time dateTime>`. El listado
(`src/app/blog/page.js:147`) sí usa `<time dateTime>`; el detalle, no.

**H-19 — La fecha de última actualización no es visible en ninguna parte.**
Solo existe como `dateModified` en el JSON-LD
(`src/components/blog/BlogArticleView.js:27`). Además `updatedAt`
(`prisma/schema.prisma:901`) se toca en cualquier `prisma.post.update`, incluidos
cambios no editoriales, así que la señal es ruidosa.

**H-20 — El `FAQPage` de `/servicios` declara contenido que no está en la página.**
`src/app/servicios/page.js:9-54` define cuatro pares pregunta/respuesta en
JSON-LD, montados en `:125`. El cuerpo de la página muestra el listado de
servicios; esas cuatro preguntas no aparecen como texto visible.

**H-21 — Los grafos JSON-LD no están enlazados: ningún nodo tiene `@id`.**
`src/app/layout.js:24`, `src/app/page.js:199`,
`src/components/blog/BlogArticleView.js:20`,
`src/app/profesionales/[slug]/page.js:110`, `src/app/servicios/[id]/page.js:144`
y `src/app/agendar/[id]/page.js:142` emiten nodos independientes. El `author`
del `Article` y el `Person` del perfil describen a la misma persona sin ninguna
identidad compartida; el `Organization` del layout y el `MedicalBusiness` de la
home son dos entidades distintas para el mismo negocio.

**H-22 — No hay ninguna URI semántica externa para los profesionales.**
`prisma/schema.prisma:244-300` no tiene campo `sameAs`, ORCID, Wikidata, perfil
de colegio ni LinkedIn. El único `sameAs` del proyecto está hardcodeado para la
organización en `src/app/layout.js:38-43`. El `Person` de
`src/app/profesionales/[slug]/page.js:110-119` no incluye `sameAs`.

**H-23 — `licenseNumber` se emite como `identifier` sin autoridad emisora.**
`src/app/profesionales/[slug]/page.js:118`:
`{ identifier: professional.licenseNumber }` — una cadena suelta («8270»). No
hay campo de colegio profesional en `ProfessionalProfile`
(`prisma/schema.prisma:257` es solo `licenseNumber String?`), ni se usa
`PropertyValue` con `propertyID`. La UI lo llama «Licencia» en
`profesionales/[slug]/page.js:165` y «Matrícula profesional» en
`src/components/ProfessionalProfileCard.js:46`.

**H-24 — Los perfiles usan `Person` en vez de un tipo médico.**
`src/app/profesionales/[slug]/page.js:113` y `src/app/agendar/[id]/page.js:142`
declaran `"@type": "Person"`. No se usa `Physician`, `MedicalOrganization` ni
`MedicalBusiness` a nivel de profesional, ni `memberOf`, ni `hasCredential`.

**H-25 — Las URLs de servicio son cuids opacos.**
`src/app/servicios/[id]/page.js` y `src/app/sitemap.js:50` usan
`Service.id` (`prisma/schema.prisma:302`, `@default(cuid())`). En producción:
`/servicios/cmm9xo7ux0000f0hps73mpfpt`. El modelo `Service` no tiene campo
`slug`.

**H-26 — `robots.txt` no cubre rutas privadas ni de vista previa.**
`src/app/robots.js:10` desautoriza `/api/`, `/panel/` e `/ingresar`. Quedan
fuera: `/mi/` (PWA de pacientes, protegida por middleware pero indexable en
robots), `/blog/preview/`, `/agendar/`, `/cambiar-password`, `/recuperar`,
`/verificar-email`. Ninguna de esas rutas declara `robots: noindex` en sus
metadatos.

### Bajos

**H-27 — Cuatro variables de entorno distintas para la misma URL base.**
`src/lib/site-url.js:18-23` acepta `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_URL`,
`NEXT_PUBLIC_APP_URL` y `NEXT_PUBLIC_BASE_URL` por compatibilidad, y
`.env.example:4-7` las define las cuatro. Si divergen, el canónico y el sitemap
pueden apuntar a hosts distintos. El valor efectivo en producción **no es
determinable** desde el código.

**H-28 — Siete implementaciones de `slugify` con tres comportamientos.**
`src/lib/carousel-spec.js:107` (correcta), `src/actions/admin-actions.js:9`,
`src/app/api/posts/route.js:9`, `src/app/api/professional/posts/[id]/route.js:6`
y `src/components/PostEditor.js:15` (idénticas y defectuosas),
`src/components/admin/AdminPostCreator.js:10` (correcta, pero solo para el
*preview*: el slug que se graba lo produce `admin-actions.js`), y
`src/app/panel/admin/marketing/page.js:69` (correcta, separador `_`). El mismo
título produce slugs distintos según por dónde entre.

**H-29 — El preview del creador admin muestra un slug distinto del que se graba.**
`src/components/admin/AdminPostCreator.js:43` calcula el preview con la variante
que normaliza NFD; `src/actions/admin-actions.js:247` graba con la que no
normaliza. El usuario ve `logicas-comunes` y en la base queda `l-gicas-comunes`.

**H-30 — Sufijos de colisión aleatorios en los slugs.**
`src/actions/admin-actions.js:251` y `src/app/api/posts/route.js:73`:
`` slug = `${slug}-${Math.random().toString(36).slice(2, 7)}` ``. En producción
existe `la-salud-mental-no-cabe-en-una-sola-disciplina-8oyy6`.
`src/app/api/admin/carousels/[id]/publish-to-blog/route.js:16-25` sí usa un
sufijo incremental determinista.

**H-31 — Tres locales distintos para formatear fechas, ninguno `es-CR`.**
`src/components/blog/BlogArticleView.js:9` usa `"es-AR"`;
`src/app/blog/page.js:23` y `src/app/blog/serie/[slug]/page.js:12` usan
`"es-ES"`. El sitio declara `lang="es"` (`src/app/layout.js:91`) y
`locale: 'es_CR'` en Open Graph (`:72`).

**H-32 — `lang="es"` sin región.**
`src/app/layout.js:91`. No hay `hreflang` ni `alternates.languages` en ninguna
ruta (búsqueda de `alternates`: solo `canonical`).

**H-33 — `Post` no tiene campo de texto alternativo de portada.**
`prisma/schema.prisma:862-865` tiene `coverImageTitle`, `coverImageAuthor` y
`coverImageNote` (créditos de la obra), pero ningún `coverImageAlt`. El `alt` se
deriva del título (`src/components/blog/BlogArticleView.js:64`,
`src/app/blog/page.js:129`).

**H-34 — El fallback de imagen es solo del lado del cliente.**
`src/components/SafeImage.js:43-50` reemplaza la fuente en el `onError` de un
componente `"use client"`. Un crawler que no ejecuta JS ve la URL original; si
el bucket de Supabase no es público, ve una URL rota.

**H-35 — `rating` se consulta y nunca se usa.**
`prisma/schema.prisma:285` (`rating Decimal? @db.Decimal(2,1)`) se selecciona en
`src/app/profesionales/[slug]/page.js:37` pero no se renderiza ni se emite como
`AggregateRating`. `bio` (`:35`) e `introVideoUrl` corren la misma suerte: se
consultan o existen y no llegan a ninguna vista pública.

**H-36 — `specialty` es texto libre sin normalizar.**
`prisma/schema.prisma:256` (`specialty String`). En producción: `"Psicólogo"`,
`"psicologia clínica"`, `"Psicólogo clínico"`, `"Psicología Clínica"`. Ese valor
alimenta `Person.jobTitle` (`src/app/profesionales/[slug]/page.js:117`) y
`Article.author.jobTitle` (`src/components/blog/BlogArticleView.js:33`).

**H-37 — Las meta descriptions de los artículos salen todas recortadas.**
`src/lib/seo.js:85` aplica `clampText(description, 160)`. 11 de los 13 posts con
excerpt lo tienen entre 221 y 388 caracteres, así que el excerpt entero se corta
por palabra.

**H-38 — Dos artículos publicados sin excerpt.**
`l-gicas-comunes-m-s-all-de-la-dicotom-a-salud-enfermedad` y
`qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-2` tienen
`excerpt = NULL`. Su meta description cae al fallback
`post.excerpt || post.title` (`src/app/blog/[slug]/page.js:24`), es decir el
título repetido; y `Article.description` queda `undefined`
(`src/components/blog/BlogArticleView.js:24`).

**H-39 — Todo el contenido publicado es de un solo autor.**
Los 15 posts son de `ral-olmedo`. Los otros tres perfiles aprobados no tienen
artículos, y `/blog?autor=andrea-robles` (enlazado desde
`src/components/ProfessionalProfileCard.js:85`) devuelve una lista vacía.

**H-40 — `/blog` declara `revalidate = 300` que no tiene efecto.**
`src/app/blog/page.js:30` fija `revalidate = 300`, pero `:33` hace
`await searchParams`, lo que fuerza render dinámico en cada request. La ruta no
aparece en `.next/prerender-manifest.json`.

**H-41 — Ningún contenido dinámico se prerenderiza en el build.**
No hay `generateStaticParams` en ninguna ruta del proyecto
(`src/app/blog/[slug]/page.js`, `src/app/servicios/[id]/page.js`,
`src/app/profesionales/[slug]/page.js`, `src/app/blog/serie/[slug]/page.js`), y
`dynamicRoutes` en `.next/prerender-manifest.json` está vacío. La primera visita
a cada artículo paga el render completo con consultas a Prisma.

**H-42 — No hay `WebSite` con `SearchAction` ni `ItemList` en las páginas de listado.**
`/blog`, `/servicios` y `/nosotros` no emiten `ItemList`; el proyecto no define
`WebSite` en ninguna parte. Los únicos `@type` presentes en `src/` son
`Organization`, `MedicalBusiness`, `Article`, `BreadcrumbList`, `FAQPage`,
`Question`, `Answer`, `Service`, `Offer`, `Person`, `ImageObject`, `ListItem`
y `ContactPoint`.

**H-43 — El bloque `images.remotePatterns` está configurado y no se usa.**
`next.config.mjs:8-15` declara `images.remotePatterns` para
`images.unsplash.com` y el host de Supabase. Como no hay ningún `next/image` en
el proyecto, la configuración es inerte.

---

## Anexo: qué no fue determinable leyendo el código

- El valor efectivo de `SITE_URL` en producción. `src/lib/site-url.js:15-30`
  resuelve entre cuatro variables de entorno con fallback a
  `https://saludmentalcostarica.com`. El HTML del build local usa el fallback,
  pero cuál gana en Vercel depende de la configuración del proyecto: **no
  determinable**.
- Si los buckets `post-covers`, `avatars` y `service-banners` de Supabase están
  hoy en público. `src/lib/images.js:17` asume que sí; el estado real del
  bucket **no es determinable** desde el repositorio.
- Si `public/og-image.png` existe en el despliegue (podría haberse subido fuera
  de git). En el repositorio **no está**.
- Si hay reglas de crawling a nivel de Vercel o de un WAF fuera de
  `vercel.json`: **no determinable**.
- Cobertura real de indexación en Google/Bing y presencia en respuestas
  generativas: requiere datos externos, **no determinable** desde el código.

---

## Anexo B: `prisma/schema.prisma` completo

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum Role {
  USER
  PROFESSIONAL
  ADMIN
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  CANCELLED_BY_USER
  CANCELLED_BY_PRO
  COMPLETED
  NO_SHOW
}

enum PaymentStatus {
  UNPAID
  PARTIALLY_PAID
  PAID
  REFUNDED
}

enum PaymentTransactionType {
  DEPOSIT_50
  BALANCE_50
  FULL_100
  /// Multa del 50% por avisar con menos de 24 horas o no asistir.
  PENALTY_50
}

enum PaymentTransactionStatus {
  PENDING // Registro creado, enlace aún no enviado
  LINK_SENT // Enlace de pago ONVO enviado al paciente por email
  APPROVED // Pago confirmado por ONVO (vía webhook)
  REJECTED // Pago rechazado o fallido
  REFUNDED // Reembolso aplicado manualmente
  EXPIRED // Reservado para compatibilidad futura
}

enum ServiceAssignmentStatus {
  PENDING
  APPROVED
  REJECTED
}

/// Dónde atiende el profesional. VIRTUAL no lleva dirección; HOME es el domicilio
/// del paciente, así que la dirección se toma al agendar, no de la ficha.
enum LocationModality {
  OFFICE
  HOME
  VIRTUAL
}

/// Toda tarifa la propone el profesional y la aprueba un admin: mientras esté en
/// PENDING sigue rigiendo la última APPROVED (o no se puede agendar si no hay).
enum RateStatus {
  PENDING
  APPROVED
  REJECTED
}

enum InsuranceClaimStatus {
  AWAITING_TEMPLATE
  PENDING_SIGNED_FORM
  COMPLETED
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum InvoiceType {
  CUSTOMER_INVOICE
  SUPPLIER_INVOICE
  CUSTOMER_CREDIT_NOTE
  SUPPLIER_CREDIT_NOTE
}

enum InvoiceStatus {
  DRAFT
  OPEN
  PAID
  CANCELLED
}

enum FEStatus {
  PENDING
  ACCEPTED
  REJECTED
}

enum DocumentType {
  FACTURA_ELECTRONICA
  NOTA_CREDITO
  NOTA_DEBITO
  TIQUETE_ELECTRONICO
}

enum TaxScope {
  SALES
  PURCHASES
  BOTH
}

// --------------------
// MODELS
// --------------------

model User {
  id             String  @id @default(cuid())
  name           String
  email          String  @unique
  passwordHash   String
  sessionVersion Int     @default(0)
  image          String?
  phone          String
  role           Role    @default(USER)

  identification String?   @db.VarChar(32)
  birthDate      DateTime?
  gender         String?   @db.VarChar(16)
  interests      String?   @db.Text

  emailVerified Boolean   @default(false)
  isActive      Boolean   @default(true)
  lastLogin     DateTime?

  acquisitionChannel String?
  campaignName       String?

  // Atribución estructurada (los dos campos de arriba se conservan como
  // resumen legible; estos guardan el detalle sin colapsar)
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
  utmTerm     String?
  utmContent  String?
  referrer    String?
  landingPath String? @db.Text

  verifyTokenHash String?
  verifyTokenExp  DateTime?
  resetTokenHash  String?
  resetTokenExp   DateTime?

  // Seguro médico
  hasInsurance           Boolean @default(false)
  useInsuranceForPayment Boolean @default(false)
  insuranceName          String? @db.VarChar(128)

  /// Datos de facturación. Solo se llenan si el paciente quiere la factura a
  /// nombre de otra persona o de una empresa, para poder deducirla. Si van
  /// vacíos, la factura sale con el nombre y la cédula de la cuenta.
  /// Es todo o nada: nombre y cédula juntos, o ninguno (ver datosFacturacionDe).
  billingName     String? @db.VarChar(100)
  billingIdType   String? @db.VarChar(2)
  billingIdNumber String? @db.VarChar(20)
  billingEmail    String?

  /// Agendamiento en pausa por avisar tarde o no asistir. El paciente no puede
  /// agendar ni mover citas por su cuenta mientras esté puesto; solo lo levanta
  /// un administrador, después de contactarlo. Ver lib/rescheduling-policy.
  schedulingBlockedAt     DateTime?
  schedulingBlockedReason String?   @db.VarChar(32)
  schedulingRestoredAt    DateTime?

  /// Última versión del acuerdo de atención que la persona aceptó, y cuándo. La
  /// prueba del consentimiento vive en AceptacionAcuerdo (Ley 8968, art. 9);
  /// estos dos campos son solo para no consultar esa tabla en cada pantalla.
  acuerdoVersion    String?   @db.VarChar(16)
  acuerdoAceptadoAt DateTime?

  /// Se le pidió volver a leer el acuerdo y todavía no lo confirmó. Se pone
  /// cuando se aplica la política (aviso tarde o inasistencia) y es un candado
  /// distinto del de la agenda: el administrador puede devolverle el acceso y
  /// aun así tiene que releer antes de volver a reservar. Ver lib/acuerdo.
  acuerdoPendienteDesde  DateTime?
  acuerdoPendienteMotivo String?   @db.VarChar(32)

  /// Dirección clínica: quien visa las altas y las bajas de los casos.
  ///
  /// No es un Role aparte a propósito —el rol operativo sigue siendo ADMIN—
  /// porque lo que habilita a leer una nota clínica no es el puesto sino la
  /// colegiatura. Sin número de colegiado no hay acceso, aunque sea admin.
  /// Ver lib/auth-guards → requireClinicalDirector.
  clinicalDirectorSince DateTime?
  colegiadoNumero       String?   @db.VarChar(32)
  colegiadoColegio      String?   @db.VarChar(64)

  insuranceBlankFormUrl        String?
  insuranceBlankFormUploadedAt DateTime?

  insurancePatientFormUrl        String?
  insurancePatientFormUploadedAt DateTime?

  insuranceTemplateUrl        String?
  insuranceTemplateUploadedAt DateTime?
  insuranceTemplateProId      String?

  professionalProfile ProfessionalProfile?

  appointments    Appointment[] @relation("PatientAppointments")
  invoiceContacts Invoice[]     @relation("InvoiceContact")
  invoicesCreated Invoice[]     @relation("InvoiceCreator")

  postViewEvents      PostViewEvent[]
  paymentTransactions PaymentTransaction[]
  insuranceClaims     InsuranceClaim[]     @relation("PatientInsuranceClaims")
  leads               Lead[]
  pushSubscriptions   PushSubscription[]

  acuerdosAceptados   AceptacionAcuerdo[]
  contactosReenganche ContactoReenganche[] @relation("ContactosDelPaciente")
  casosComoPaciente   Caso[]               @relation("CasosDelPaciente")
  casosVisados        Caso[]               @relation("CasosVisados")
  eventosDeCaso       CasoEvento[]         @relation("EventosDelActor")
  notasDeCaso         CasoNota[]           @relation("NotasDelAutor")
  // Back-relation necesaria para que borrar un usuario se lleve sus acuses de
  // lectura y no queden huérfanos.
  messageReceipts     AdminMessageRecipient[]

  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
  Settlement Settlement[]

  @@index([identification])
  @@index([role])
}

model ProfessionalProfile {
  id String @id @default(cuid())

  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  slug                     String    @unique
  specialty                String
  licenseNumber            String?
  bio                      String?   @db.Text
  profileReview            String?   @db.Text
  profileReviewDraft       String?   @db.Text
  profileReviewStatus      String    @default("EMPTY")
  profileReviewSubmittedAt DateTime?
  profileReviewReviewedAt  DateTime?
  profileReviewAdminNote   String?   @db.Text
  coverLetter              String?   @db.Text
  cvUrl                    String?
  introVideoUrl            String?

  avatarUrl          String?
  calendarUrl        String?
  googleRefreshToken String? @db.Text

  // SEO editorial: si van vacíos, el metadata se deriva del contenido (ver src/lib/seo.js)
  metaTitle       String?
  metaDescription String?  @db.Text
  ogImage         String?
  focusKeyword    String?
  noindex         Boolean  @default(false)

  isApproved Boolean @default(false)

  rating     Decimal? @db.Decimal(2, 1)
  commission Int      @default(10)

  // ✅ Lo que tu código espera
  serviceAssignments  ServiceAssignment[]
  paymentTransactions PaymentTransaction[]

  availability Availability[]
  posts        Post[]

  practiceLocations PracticeLocation[]
  timeBands         ProfessionalTimeBand[]

  appointments      Appointment[]      @relation("ProAppointments")
  invoices          Invoice[]          @relation("InvoiceProfessional")
  homeCarouselItems HomeCarouselItem[]
  insuranceClaims   InsuranceClaim[]
  casos             Caso[]             @relation("CasosDelProfesional")

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  settlements Settlement[]
}

model Service {
  id                  String  @id @default(cuid())
  title               String
  description         String? @db.Text
  bannerImage         String?
  bannerFocusX        Int     @default(50)
  bannerFocusY        Int     @default(50)
  bannerScale         Int     @default(100)
  bannerArtworkTitle  String?
  bannerArtworkAuthor String?
  bannerArtworkNote   String? @db.Text

  price        Decimal @db.Decimal(10, 2)
  durationMin  Int
  displayOrder Int     @default(0)
  isActive     Boolean @default(true)

  // ✅ Lo que tu código espera
  professionalAssignments ServiceAssignment[]

  cabysCode String?
  taxId     String?
  tax       Tax?    @relation(fields: [taxId], references: [id], onDelete: SetNull)

  // SEO editorial: si van vacíos, el metadata se deriva del contenido (ver src/lib/seo.js)
  metaTitle       String?
  metaDescription String?  @db.Text
  ogImage         String?
  focusKeyword    String?
  noindex         Boolean  @default(false)

  appointments Appointment[]
  invoiceLines InvoiceLine[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
  @@index([displayOrder])
  @@index([title])
}

model Tax {
  id        String   @id @default(cuid())
  name      String
  rate      Decimal  @db.Decimal(5, 2)
  scope     TaxScope
  label     String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  productsSale     Product[]     @relation("ProductSaleTax")
  productsPurchase Product[]     @relation("ProductPurchaseTax")
  services         Service[]
  invoiceLines     InvoiceLine[]

  @@index([scope, isActive])
}

model Product {
  id                String   @id @default(cuid())
  name              String
  description       String?  @db.Text
  internalReference String?
  productType       String   @default("service")
  cabysCode         String?
  category          String?  @default("All")
  salePrice         Decimal  @default(0) @db.Decimal(15, 2)
  costPrice         Decimal  @default(0) @db.Decimal(15, 2)
  saleTaxId         String?
  purchaseTaxId     String?
  saleUom           String?  @default("Unidad(es)")
  purchaseUom       String?  @default("Unidad(es)")
  incomeAccount     String?
  expenseAccount    String?
  canBeSold         Boolean  @default(true)
  canBePurchased    Boolean  @default(true)
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  saleTax      Tax?          @relation("ProductSaleTax", fields: [saleTaxId], references: [id], onDelete: SetNull)
  purchaseTax  Tax?          @relation("ProductPurchaseTax", fields: [purchaseTaxId], references: [id], onDelete: SetNull)
  invoiceLines InvoiceLine[]
}

model InvoiceSequence {
  id            String      @id @default(cuid())
  sequenceType  InvoiceType @unique
  prefix        String?
  currentNumber Int         @default(0)
  year          Int
  padding       Int         @default(4)
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
}

model Invoice {
  id             String       @id @default(cuid())
  invoiceNumber  String
  invoiceType    InvoiceType
  feNumber       String?
  feClave        String?
  feStatus       FEStatus     @default(PENDING)
  feErrorMessage String?

  /// Comprobante firmado tal cual se envió a Hacienda, y la respuesta que devolvió.
  /// Antes se descartaban después del envío: Hacienda exige conservarlos cinco
  /// años y entregarle el XML al receptor, así que sin esto no había ni copia.
  /// Van en la base y no en Storage porque pesan ~8 KB y evitan depender de
  /// permisos de buckets.
  feXml          String? @db.Text
  feRespuestaXml String? @db.Text
  documentType   DocumentType @default(FACTURA_ELECTRONICA)

  contactId       String
  appointmentId   String?
  professionalId  String?
  contactName     String?
  contactIdNumber String?
  /// Tipo de identificación de Hacienda (01 física, 02 jurídica, 03 DIMEX,
  /// 04 NITE). Se guarda el que se usó al emitir en vez de re-deducirlo del
  /// largo: jurídica y NITE tienen ambos 10 dígitos.
  contactIdType   String? @db.VarChar(2)

  invoiceDate DateTime
  dueDate     DateTime
  paymentDate DateTime?

  economicActivity String?
  paymentMethod    String? @default("transfer")
  currency         String  @default("CRC")

  supplierReference        String?
  supplierEconomicActivity String?
  attachmentUrl            String?
  xmlUrl                   String?
  supplierFeClave          String?   @db.VarChar(50)
  supplierIdNumber         String?   @db.VarChar(32)
  acceptanceStatus         String?
  acceptanceAt             DateTime?

  subtotal       Decimal @default(0) @db.Decimal(15, 2)
  taxAmount      Decimal @default(0) @db.Decimal(15, 2)
  discountAmount Decimal @default(0) @db.Decimal(15, 2)
  total          Decimal @default(0) @db.Decimal(15, 2)
  amountPaid     Decimal @default(0) @db.Decimal(15, 2)
  balance        Decimal @default(0) @db.Decimal(15, 2)

  status InvoiceStatus @default(DRAFT)

  originInvoiceId String?
  originDocument  String?
  notes           String?  @db.Text
  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  contact       User                 @relation("InvoiceContact", fields: [contactId], references: [id], onDelete: Restrict)
  appointment   Appointment?         @relation("AppointmentInvoices", fields: [appointmentId], references: [id], onDelete: SetNull)
  professional  ProfessionalProfile? @relation("InvoiceProfessional", fields: [professionalId], references: [id], onDelete: SetNull)
  creator       User?                @relation("InvoiceCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  originInvoice Invoice?             @relation("InvoiceOrigin", fields: [originInvoiceId], references: [id], onDelete: SetNull)
  creditNotes   Invoice[]            @relation("InvoiceOrigin")
  lines         InvoiceLine[]
  settlements   Settlement[]

  @@unique([invoiceType, invoiceNumber])
  @@index([invoiceType, status])
  @@index([contactId])
  @@index([appointmentId])
  @@index([professionalId])
  @@index([invoiceDate])
}

model InvoiceLine {
  id              String   @id @default(cuid())
  invoiceId       String
  productId       String?
  serviceId       String?
  productName     String
  description     String?  @db.Text
  cabysCode       String?
  accountCode     String?
  quantity        Decimal  @default(1) @db.Decimal(10, 2)
  unitOfMeasure   String?  @default("Unidad(es)")
  unitPrice       Decimal  @db.Decimal(15, 2)
  discountPercent Decimal  @default(0) @db.Decimal(5, 2)
  discountType    String?
  taxId           String?
  taxRate         Decimal  @default(0) @db.Decimal(5, 2)
  taxAmount       Decimal  @default(0) @db.Decimal(15, 2)
  lineSubtotal    Decimal  @default(0) @db.Decimal(15, 2)
  lineTotal       Decimal  @default(0) @db.Decimal(15, 2)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())

  invoice Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  product Product? @relation(fields: [productId], references: [id], onDelete: SetNull)
  service Service? @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  tax     Tax?     @relation(fields: [taxId], references: [id], onDelete: SetNull)

  @@index([invoiceId, sortOrder])
}

model ServiceAssignment {
  professionalId String
  serviceId      String

  status ServiceAssignmentStatus @default(PENDING)

  /// OBSOLETOS: el precio pasó a ProfessionalRate, que admite un valor por lugar
  /// y franja horaria. Se conservan como respaldo de los datos migrados; nadie
  /// debe leerlos para cobrar. La migración los volcó a una tarifa "cualquiera".
  proposedSessionPrice Decimal? @db.Decimal(10, 2)
  approvedSessionPrice Decimal? @db.Decimal(10, 2)

  adminReviewNote String? @db.Text

  /// OBSOLETO: los enlaces ONVO se crean por cita vía API con el precio congelado
  /// de esa cita, no de forma estática por asignación. Ver src/lib/onvo/client.js.
  onvoPaymentLinkId String?

  rates ProfessionalRate[]

  // ✅ usados por admin/profile-actions
  requestedAt DateTime  @default(now())
  reviewedAt  DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  professional ProfessionalProfile @relation(fields: [professionalId], references: [id], onDelete: Cascade)
  service      Service             @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@id([professionalId, serviceId])
  @@index([serviceId])
  @@index([professionalId])
  @@index([status])
  @@index([requestedAt])
  @@index([onvoPaymentLinkId])
}

model Availability {
  id             String @id @default(cuid())
  professionalId String

  dayOfWeek Int
  startTime String @db.VarChar(5)
  endTime   String @db.VarChar(5)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  professional ProfessionalProfile @relation(fields: [professionalId], references: [id], onDelete: Cascade)

  /// Lugares en los que el profesional puede atender este bloque. El paciente
  /// elige entre ellos al agendar y el precio se resuelve según su elección.
  /// Si el bloque no declara ninguno, se ofrecen los lugares activos de la ficha.
  locations AvailabilityLocation[]

  @@unique([professionalId, dayOfWeek, startTime, endTime])
  @@index([professionalId, dayOfWeek])
}

/// Qué lugares se ofrecen en cada bloque de disponibilidad. El conflicto de agenda
/// se sigue evaluando por profesional y hora, así que dos pacientes no pueden
/// tomar el mismo horario aunque elijan modalidades distintas.
model AvailabilityLocation {
  availabilityId String
  locationId     String

  availability Availability     @relation(fields: [availabilityId], references: [id], onDelete: Cascade)
  location     PracticeLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@id([availabilityId, locationId])
  @@index([locationId])
}

/// Un lugar donde el profesional atiende: su consultorio, a domicilio o virtual.
/// Cada uno puede tener una tarifa distinta (ver ProfessionalRate).
model PracticeLocation {
  id             String @id @default(cuid())
  professionalId String

  name         String /// Rótulo visible al paciente, ej. "Consultorio Escazú"
  modality     LocationModality
  address      String?
  instructions String? @db.Text /// Cómo llegar, piso, timbre, o el enlace de la sala virtual
  isActive     Boolean @default(true)
  displayOrder Int     @default(0)

  professional ProfessionalProfile @relation(fields: [professionalId], references: [id], onDelete: Cascade)

  rates            ProfessionalRate[]
  availabilityLinks AvailabilityLocation[]
  appointments     Appointment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([professionalId, name])
  @@index([professionalId, isActive])
}

/// Franja horaria propia de cada profesional, ej. "Matutino" 07:00-13:00.
/// Permite cobrar distinto según la hora sin repetir rangos en cada tarifa.
model ProfessionalTimeBand {
  id             String @id @default(cuid())
  professionalId String

  name         String
  startTime    String @db.VarChar(5)
  endTime      String @db.VarChar(5)
  displayOrder Int    @default(0)

  professional ProfessionalProfile @relation(fields: [professionalId], references: [id], onDelete: Cascade)

  rates ProfessionalRate[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([professionalId, name])
  @@index([professionalId])
}

/// Precio de una consulta para una combinación de servicio, lugar y franja.
/// `locationId` o `timeBandId` en NULL significan "cualquiera": así un profesional
/// que cobra siempre igual carga una sola tarifa y solo agrega filas donde difiere.
/// La resolución en cascada vive en src/lib/rates.js.
///
/// La unicidad del alcance NO se puede expresar con @@unique porque en Postgres
/// dos NULL son distintos entre sí; la migración crea un índice único sobre
/// COALESCE(locationId,'') y COALESCE(timeBandId,'').
model ProfessionalRate {
  id             String  @id @default(cuid())
  professionalId String
  serviceId      String
  locationId     String?
  timeBandId     String?

  proposedPrice   Decimal?   @db.Decimal(10, 2)
  approvedPrice   Decimal?   @db.Decimal(10, 2)
  status          RateStatus @default(PENDING)
  adminReviewNote String?    @db.Text
  requestedAt     DateTime   @default(now())
  reviewedAt      DateTime?

  assignment ServiceAssignment     @relation(fields: [professionalId, serviceId], references: [professionalId, serviceId], onDelete: Cascade)
  location   PracticeLocation?     @relation(fields: [locationId], references: [id], onDelete: Cascade)
  timeBand   ProfessionalTimeBand? @relation(fields: [timeBandId], references: [id], onDelete: Cascade)

  appointments Appointment[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([professionalId, serviceId])
  @@index([status])
  @@index([locationId])
  @@index([timeBandId])
}

model Appointment {
  id String @id @default(cuid())

  date    DateTime          @db.Timestamptz(6)
  endDate DateTime          @db.Timestamptz(6)
  status  AppointmentStatus @default(PENDING)

  /// Precio congelado al agendar: es lo que el paciente aceptó pagar en ese
  /// momento y no cambia aunque el profesional actualice su tarifa después.
  pricePaid     Decimal?      @db.Decimal(10, 2)
  paymentStatus PaymentStatus @default(UNPAID)
  commissionFee Decimal?      @db.Decimal(10, 2)

  /// Tarifa de la que salió `pricePaid`. Solo para trazabilidad: si se borra la
  /// tarifa, el precio y la copia del lugar siguen siendo válidos.
  rateId String?
  rate   ProfessionalRate? @relation(fields: [rateId], references: [id], onDelete: SetNull)

  /// Lugar elegido por el paciente, con copia congelada de sus datos para que la
  /// cita y la factura sigan siendo legibles si el profesional lo edita o borra.
  locationId      String?
  location        PracticeLocation? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  modality        LocationModality?
  locationName    String?
  locationAddress String?
  timeBandName    String?

  gcalEventId String?
  meetLink    String?

  patientId String
  patient   User   @relation("PatientAppointments", fields: [patientId], references: [id], onDelete: Cascade)

  professionalId String
  professional   ProfessionalProfile @relation("ProAppointments", fields: [professionalId], references: [id], onDelete: Cascade)

  serviceId String?
  service   Service? @relation(fields: [serviceId], references: [id], onDelete: Restrict)

  cancelReason      String?
  canceledBy        String? // 'PATIENT' | 'PROFESSIONAL' | 'ADMIN'
  canceledAt        DateTime?
  lastRescheduledBy String?
  lastRescheduledAt DateTime?
  rescheduleCount   Int       @default(0)

  parentAppointmentId String?
  parentAppointment   Appointment?  @relation("FollowUps", fields: [parentAppointmentId], references: [id], onDelete: SetNull)
  followUps           Appointment[] @relation("FollowUps")

  isFirstWithProfessional Boolean              @default(false)

  /// Cuándo se aplicó la multa por aviso tardío o inasistencia. Evita
  /// cobrarla dos veces si se vuelve a marcar el mismo estado.
  penaltyAppliedAt DateTime?

  // Atribución publicitaria capturada al agendar (para la conversión GA4 del
  // adelanto, que se confirma server-side días después). Ver src/lib/analytics.
  gaClientId String? // client_id de GA4 (cookie _ga) o sintético estable
  gaGclid    String? // gclid del anuncio de Google Ads, si vino en la URL

  paymentTransactions     PaymentTransaction[]
  invoices                Invoice[]            @relation("AppointmentInvoices")
  insuranceClaim          InsuranceClaim?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([date])
  @@index([patientId])
  @@index([professionalId])
  @@index([serviceId])
  @@index([status])
  @@index([parentAppointmentId])
}

model PaymentTransaction {
  id String @id @default(cuid())

  appointmentId  String
  professionalId String
  patientId      String

  type     PaymentTransactionType
  amount   Decimal                @db.Decimal(10, 2)

  /// Cuándo se le avisó al paciente que este pago se acreditó. Queda en NULL
  /// hasta que efectivamente lo ve: así el aviso lo espera aunque no estuviera
  /// conectado al momento de pagar, y no se repite una vez mostrado.
  patientNotifiedAt DateTime?
  currency String                 @default("CRC")
  taxRate  Int                    @default(4)
  processingFee Decimal?          @db.Decimal(10, 2)

  /// ONVO cobra un fijo POR TRANSACCIÓN en dólares (US$0.35 con tarjeta), no en
  /// colones. Se guarda el monto en dólares y el tipo de cambio con el que se
  /// convirtió, porque la liquidación de ONVO llega con SU tipo de cambio del
  /// día: sin estos dos datos no hay forma de explicar la diferencia.
  /// processingFee es la suma ya convertida, y es una estimación.
  processingFeeUsd Decimal? @db.Decimal(10, 2)
  usdCrcRate       Decimal? @db.Decimal(12, 4)

  // Campos ONVO Pay
  onvoPaymentLinkId String? // ID del enlace de pago ONVO del profesional (ej. live_xxx)
  onvoEventId       String? @unique // ID del evento webhook de ONVO (idempotencia)

  status         PaymentTransactionStatus @default(PENDING)
  statusMessage  String?                  @db.Text
  paidAt         DateTime?
  webhookPayload Json?

  // Idempotencia de la conversión GA4/Ads: se reclama de forma atómica antes de
  // enviar, para no inflar conversiones si el webhook reintenta o se concilia manual.
  conversionSent   Boolean   @default(false)
  conversionSentAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  appointment    Appointment         @relation(fields: [appointmentId], references: [id], onDelete: Cascade)
  professional   ProfessionalProfile @relation(fields: [professionalId], references: [id])
  patient        User                @relation(fields: [patientId], references: [id])
  settlementItem SettlementItem?

  @@index([appointmentId])
  @@index([professionalId])
  @@index([patientId])
  @@index([onvoPaymentLinkId])
  @@index([status, createdAt])
}

model Settlement {
  id             String   @id @default(cuid())
  professionalId String
  periodStart    DateTime
  periodEnd      DateTime
  grossAmount    Decimal  @db.Decimal(12, 2)
  commissionPct  Int
  commissionAmt  Decimal  @db.Decimal(12, 2)
  processingFeeAmt Decimal @default(0) @db.Decimal(12, 2)
  netAmount      Decimal  @db.Decimal(12, 2)
  status         String   @default("OPEN")
  invoiceId      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  professional ProfessionalProfile @relation(fields: [professionalId], references: [id], onDelete: Cascade)
  invoice      Invoice?            @relation(fields: [invoiceId], references: [id], onDelete: SetNull)
  items        SettlementItem[]
  User         User?               @relation(fields: [userId], references: [id])
  userId       String?

  @@unique([professionalId, periodStart, periodEnd])
  @@index([status])
}

model SettlementItem {
  id                    String  @id @default(cuid())
  settlementId          String
  transactionId         String  @unique
  amount                Decimal @db.Decimal(10, 2)
  commissionAmt         Decimal @db.Decimal(10, 2)
  commissionPct         Int     @default(0)
  consultationNumber    Int?
  commissionPlanVersion String?
  processingFeeAmt Decimal @default(0) @db.Decimal(10, 2)
  netAmount     Decimal @default(0) @db.Decimal(10, 2)

  settlement  Settlement         @relation(fields: [settlementId], references: [id], onDelete: Cascade)
  transaction PaymentTransaction @relation(fields: [transactionId], references: [id], onDelete: Restrict)
}

model FiscalPeriod {
  id           String    @id @default(cuid())
  year         Int
  month        Int
  status       String    @default("OPEN")
  ivaDebito    Decimal?  @db.Decimal(15, 2)
  ivaCredito   Decimal?  @db.Decimal(15, 2)
  ivaNeto      Decimal?  @db.Decimal(15, 2)
  withholdings Decimal   @default(0) @db.Decimal(15, 2)
  snapshot     Json?
  filedAt      DateTime?
  filedReceipt String?
  notes        String?   @db.Text
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([year, month])
}

model Post {
  id               String     @id @default(cuid())
  title            String
  slug             String     @unique
  content          String     @db.Text
  excerpt          String?    @db.Text
  coverImage       String?
  coverImageTitle  String?
  coverImageAuthor String?
  coverImageNote   String?    @db.Text
  coverImageFocusX Int        @default(50)
  coverImageFocusY Int        @default(50)
  coverImageScale  Int        @default(100)
  status           PostStatus @default(DRAFT)

  // SEO editorial: si van vacíos, el metadata se deriva del contenido (ver src/lib/seo.js)
  metaTitle       String?
  metaDescription String?  @db.Text
  ogImage         String?
  focusKeyword    String?
  noindex         Boolean  @default(false)

  authorId String
  author   ProfessionalProfile @relation(fields: [authorId], references: [id], onDelete: Cascade)

  // Taxonomía de biblioteca (ver models Discipline/Topic/Series abajo).
  // seriesId/seriesOrder son opcionales: un artículo puede no pertenecer a
  // ninguna serie. Las disciplinas y temas van por tablas de unión con estado
  // SUGERIDA/APROBADA (el profesional sugiere, el admin aprueba).
  seriesId       String?
  series         Series? @relation(fields: [seriesId], references: [id], onDelete: SetNull)
  seriesOrder    Int?
  seriesApproved Boolean @default(false)

  // Estado que el profesional SUGIERE (borrador / listo para publicar /
  // archivar). El admin lo ve y decide el `status` real. No gatea nada por sí
  // solo; es una señal editorial.
  suggestedStatus SuggestedStatus?

  disciplines PostDiscipline[]
  topics      PostTopic[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  viewEvents        PostViewEvent[]
  homeCarouselItems HomeCarouselItem[]

  @@index([status])
  @@index([authorId])
  @@index([seriesId])
}

model HomeCarouselItem {
  id String @id @default(cuid())

  kind         String
  label        String?
  isActive     Boolean @default(true)
  displayOrder Int     @default(0)

  postId String?
  post   Post?   @relation(fields: [postId], references: [id], onDelete: Cascade)

  professionalId String?
  professional   ProfessionalProfile? @relation(fields: [professionalId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([kind, isActive, displayOrder])
  @@index([postId])
  @@index([professionalId])
}

model InsuranceClaim {
  id                   String               @id @default(cuid())
  patientId            String
  appointmentId        String               @unique
  professionalId       String
  paymentDate          DateTime?
  signedFormUrl        String?
  signedFormUploadedAt DateTime?
  emailSentAt          DateTime?
  status               InsuranceClaimStatus @default(AWAITING_TEMPLATE)
  createdAt            DateTime             @default(now())
  updatedAt            DateTime             @updatedAt

  patient      User                @relation("PatientInsuranceClaims", fields: [patientId], references: [id])
  appointment  Appointment         @relation(fields: [appointmentId], references: [id])
  professional ProfessionalProfile @relation(fields: [professionalId], references: [id])

  @@index([patientId])
  @@index([professionalId])
  @@index([status])
}

model PostViewEvent {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  postId String
  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)

  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  anonId      String
  sessionId   String
  landingUrl  String? @db.Text
  referrer    String? @db.Text
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
  utmTerm     String?
  utmContent  String?

  userAgent String? @db.Text
  country   String?

  isRead            Boolean   @default(false)
  readAt            DateTime?
  timeOnPageSeconds Int?
  scrollDepth       Int?

  @@unique([sessionId, postId])
  @@index([postId, createdAt])
  @@index([createdAt])
  @@index([anonId])
}

// Registro de intentos para rate limiting (SEC-01).
// Cada fila es un intento contado dentro de una ventana temporal.
// La limpieza de entradas viejas es oportunista (ver src/lib/rate-limit.js).
model RateLimitEntry {
  id        String   @id @default(cuid())
  key       String // ej. "login:1.2.3.4:correo@x.com"
  createdAt DateTime @default(now())

  @@index([key, createdAt])
}

// Pagos ONVO que no se pudieron emparejar con una transacción (PAY-01).
// Se registran para conciliación manual; NO tocan ninguna cita.
// reason: NO_TRANSACTION | AMOUNT_MISMATCH | EMAIL_MISMATCH | MULTIPLE_CANDIDATES
model UnmatchedPayment {
  id            String    @id @default(cuid())
  onvoEventId   String    @unique
  onvoLinkId    String?
  amount        Decimal?  @db.Decimal(10, 2)
  currency      String?
  customerEmail String?
  reason        String
  payload       Json
  resolvedAt    DateTime?
  resolvedTxId  String?
  createdAt     DateTime  @default(now())

  @@index([createdAt])
}

// Pipeline de leads de marketing: personas que escriben por los formularios
// públicos (contacto / FAQ) antes de registrarse. Los registros ya viven en
// User; un Lead se enlaza automáticamente a su User si luego se registra con
// el mismo email (ver registerUser / registerProfessional).
enum LeadChannel {
  CONTACT_FORM
  FAQ_FORM
  WHATSAPP // reservado: aún no hay superficie pública de WhatsApp
}

enum LeadStatus {
  NEW // sin atender
  CONTACTED // el admin ya respondió
  CONVERTED // se registró en la plataforma
  DISCARDED // spam o no aplica
}

model Lead {
  id      String      @id @default(cuid())
  name    String
  email   String
  phone   String?
  subject String? // asunto elegido en el form del FAQ
  message String      @db.Text
  channel LeadChannel @default(CONTACT_FORM)
  status  LeadStatus  @default(NEW)

  adminNote String? @db.Text

  // Atribución estructurada (último toque capturado en el cliente)
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
  utmTerm     String?
  utmContent  String?
  referrer    String?
  landingPath String? @db.Text

  // Se completa solo si el lead se registra después con el mismo email
  userId String?
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([email])
  @@index([createdAt])
}

// Gasto publicitario por canal y mes, cargado a mano por el admin. Alimenta el
// CAC del dashboard de atribución (gasto / pacientes que pagaron la 1ª cita).
model ChannelSpend {
  id       String  @id @default(cuid())
  source   String // utm_source (ej. "meta", "google"); "directo" para orgánico
  month    String // "YYYY-MM"
  amount   Decimal @db.Decimal(12, 2)
  currency String  @default("CRC")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([source, month])
  @@index([month])
}

// Suscripciones Web Push de la PWA de pacientes (una por navegador/dispositivo).
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
}

// Carruseles de Instagram generados desde el panel admin (api/slides + generador PIL).
enum CarouselStatus {
  DRAFT
  GENERATED
  APPROVED
  PUBLISHED
}

model Carousel {
  id     String         @id @default(cuid())
  slug   String         @unique
  title  String
  status CarouselStatus @default(DRAFT)
  spec   Json

  activeVersionId String? @unique

  articleUrl String?

  // Artículo fuente (para "Enviar al blog"). Plano por diseño: sourcePostId/blogPostId
  // guardan ids de Post sin FK, para no añadir back-relations al modelo Post.
  sourceText   String? @db.Text // texto usado como fuente (paste/.md); null si se creó a mano
  sourcePostId String? // id del Post si la fuente ya era un artículo del blog (no se duplica)
  blogPostId   String? // id del Post creado vía "Enviar al blog" (evita duplicar)

  // Id del User que lo creó (admin o profesional). Plano por diseño.
  createdBy String

  // Id del ProfessionalProfile atribuido como autor. Plano (sin FK) para no
  // añadir back-relation al modelo ProfessionalProfile. Profesional que crea = él
  // mismo; admin puede elegirlo al crear. Null si admin no atribuye.
  authorId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  assets CarouselAsset[]
  versions CarouselVersion[] @relation("CarouselVersions")
  activeVersion CarouselVersion? @relation("CarouselActiveVersion", fields: [activeVersionId], references: [id], onDelete: SetNull)
  approvalEvents CarouselApprovalEvent[]

  @@index([status])
  @@index([createdBy])
  @@index([authorId])
  @@index([activeVersionId])
}

model CarouselAsset {
  id          String   @id @default(cuid())
  carouselId  String
  carousel    Carousel @relation(fields: [carouselId], references: [id], onDelete: Cascade)
  index       Int
  filename    String
  storagePath String
  width       Int      @default(1080)
  height      Int      @default(1080)

  // Revisión por slide: nota de edición + marca de "listo".
  ready Boolean @default(false)
  note  String? @db.Text

  @@unique([carouselId, index])
  @@index([carouselId])
}

model CarouselVersion {
  id             String   @id @default(cuid())
  carouselId     String
  number         Int
  spec           Json
  specHash       String
  parentVersionId String?
  comment        String?  @db.Text
  source         String   @default("MANUAL")
  createdBy      String
  createdAt      DateTime @default(now())

  carousel       Carousel          @relation("CarouselVersions", fields: [carouselId], references: [id], onDelete: Cascade)
  activeCarousel Carousel?          @relation("CarouselActiveVersion")
  parent         CarouselVersion?  @relation("CarouselVersionParent", fields: [parentVersionId], references: [id], onDelete: SetNull)
  children       CarouselVersion[] @relation("CarouselVersionParent")
  assets         CarouselVersionAsset[]
  approvalEvents CarouselApprovalEvent[]

  @@unique([carouselId, number])
  @@index([carouselId, createdAt])
  @@index([parentVersionId])
}

model CarouselVersionAsset {
  id          String   @id @default(cuid())
  versionId   String
  slideId     String
  role        String   @default("rendered-slide")
  index       Int
  filename    String
  storagePath String
  mimeType    String?
  sha256      String?
  note        String?  @db.Text
  width       Int      @default(1080)
  height      Int      @default(1080)
  createdAt   DateTime @default(now())

  version CarouselVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([versionId, slideId, role])
  @@index([versionId])
  @@index([slideId])
}

model CarouselApprovalEvent {
  id        String   @id @default(cuid())
  carouselId String
  versionId String
  slideId   String
  status    String
  actorId   String
  comment   String?  @db.Text
  createdAt DateTime @default(now())

  carousel Carousel        @relation(fields: [carouselId], references: [id], onDelete: Cascade)
  version  CarouselVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@index([carouselId, slideId, createdAt])
  @@index([versionId])
}

// ─── Taxonomía de la biblioteca del blog ─────────────────────────────────────
// Vocabularios controlados que administra el admin. La cara pública solo muestra
// etiquetas con estado APPROVED; el profesional las crea como SUGGESTED.

enum TagStatus {
  SUGGESTED
  APPROVED
}

// Estado de publicación que sugiere el profesional; el admin decide el real.
enum SuggestedStatus {
  DRAFT
  READY
  ARCHIVE
}

// Fase: nivel por encima de la serie (Fase > Serie > Parte). Una fase agrupa
// varias series. Vocabulario controlado, como disciplinas y temas.
model Phase {
  id       String  @id @default(cuid())
  name     String  @unique
  slug     String  @unique
  order    Int     @default(0)
  isActive Boolean @default(true)

  series Series[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
}

model Discipline {
  id       String  @id @default(cuid())
  name     String  @unique
  slug     String  @unique
  order    Int     @default(0)
  isActive Boolean @default(true)

  posts PostDiscipline[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
}

model Topic {
  id       String  @id @default(cuid())
  name     String  @unique
  slug     String  @unique
  order    Int     @default(0)
  isActive Boolean @default(true)

  posts PostTopic[]

  // Temas complementarios (relación curada por el admin, no simétrica en la
  // tabla pero se consulta en ambos sentidos). "ansiedad" complementa "sueño".
  complementsFrom TopicComplement[] @relation("complementFrom")
  complementsTo   TopicComplement[] @relation("complementTo")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive, order])
}

model TopicComplement {
  id     String @id @default(cuid())
  fromId String
  toId   String
  from   Topic  @relation("complementFrom", fields: [fromId], references: [id], onDelete: Cascade)
  to     Topic  @relation("complementTo", fields: [toId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@unique([fromId, toId])
  @@index([toId])
}

model Series {
  id          String  @id @default(cuid())
  name        String  @unique
  slug        String  @unique
  description String? @db.Text
  isActive    Boolean @default(true)

  // Fase a la que pertenece la serie (opcional). Fase > Serie > Parte.
  phaseId String?
  phase   Phase?  @relation(fields: [phaseId], references: [id], onDelete: SetNull)

  posts Post[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
  @@index([phaseId])
}

model PostDiscipline {
  postId       String
  disciplineId String
  status       TagStatus @default(SUGGESTED)

  post       Post       @relation(fields: [postId], references: [id], onDelete: Cascade)
  discipline Discipline @relation(fields: [disciplineId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([postId, disciplineId])
  @@index([disciplineId, status])
}

model PostTopic {
  postId  String
  topicId String
  status  TagStatus @default(SUGGESTED)

  post  Post  @relation(fields: [postId], references: [id], onDelete: Cascade)
  topic Topic @relation(fields: [topicId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@id([postId, topicId])
  @@index([topicId, status])
}

// ─── Frase diaria ────────────────────────────────────────────────────────────
// El corpus (1.112 frases, 486 fuentes, 5.840 asignaciones) es material
// editorial cerrado y vive versionado en src/data/frases/. Aquí solo persiste lo
// que cambia: qué eligió el admin cada día y qué fuentes ya se verificaron.

enum PhrasePickStatus {
  APPROVED    // elegida entre las candidatas del día
  SUBSTITUTED // traída de otro punto del corpus porque ninguna candidata servía
  SKIPPED     // ese día no se publica frase
}

model DailyPhrasePick {
  id   String @id @default(cuid())
  // Fecha de publicación en hora de Costa Rica, 'YYYY-MM-DD'. Texto y no
  // DateTime a propósito: es un día de calendario, no un instante, y así no hay
  // forma de que un servidor en UTC lo corra un día.
  date String

  // Cada una de las 8 audiencias decide su propia frase el mismo día: la
  // unicidad es (date, audience), no date sola. Con date sola, elegir la
  // frase de una audiencia pisaba silenciosamente la de las otras 7.
  audience String

  // Índice en el corpus versionado, más una copia de lo aprobado. La copia es
  // deliberada: lo que se publicó tiene que poder reconstruirse aunque el
  // corpus se regenere y los índices se muevan.
  phraseIndex   Int
  phraseText    String @db.Text
  author        String
  work          String
  sourceKey     String
  corpusVersion String

  // Slot de origen (1 ancla, 2 contrapunto) cuando la frase salió de las
  // candidatas del día. Null cuando se sustituyó por otra del corpus.
  slot Int?

  status PhrasePickStatus @default(APPROVED)
  note   String?          @db.Text

  // Id del User admin que decidió. Plano por diseño, como en Carousel: evita
  // añadir back-relations al modelo User.
  decidedBy String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([date, audience])
  @@index([status])
  @@index([sourceKey])
}

// Estado de la lista de verificación del Anexo A. El propio corpus advierte que
// hay referencias a obras inexistentes y glosas presentadas como citas
// literales: sin fuente verificada no se genera placa para redes.
model PhraseSourceCheck {
  id        String  @id @default(cuid())
  sourceKey String  @unique
  author    String
  work      String
  verified  Boolean @default(false)
  note      String? @db.Text

  verifiedBy String?
  verifiedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([verified])
}

// ─── Casilla de mensajes del admin ───────────────────────────────────────────
// Comunicación de una vía: el admin difunde, el usuario lee. No hay respuesta a
// propósito — un buzón bidireccional que nadie vigila en tiempo real es un mal
// lugar para que alguien describa una crisis.

enum MessageTargetKind {
  ALL      // todos los usuarios activos
  AUDIENCE // una o varias de las audiencias registradas (MR26, HR26, MRJ, HRJ)
}

enum MessageStatus {
  DRAFT
  SENT
}

model AdminMessage {
  id    String @id @default(cuid())
  title String
  body  String @db.Text

  // Segmentación por intersección de filtros opcionales. Las listas van como
  // texto separado por comas y no como arrays de Postgres, para no ser el
  // único modelo del schema con arrays escalares.
  //
  //   conjunto base   = todos los activos, o los de las audiencias elegidas
  //   ∩ filtro de citas (profesional / servicio / ventana temporal)
  //   [negable: "los que NO cumplen el filtro de citas"]
  targetKind      MessageTargetKind @default(ALL)
  targetAudiences String?

  // Filtro por citas. Se activa si hay profesionales, servicios o ventana.
  targetProfessionals String?
  targetServices      String?
  // "UPCOMING" (citas futuras activas) | "PAST" (ya ocurridas) | "ANY".
  targetWindow        String?
  // Para UPCOMING: cuántos días hacia adelante mirar. Null = sin tope.
  targetWindowDays    Int?
  // Si las citas canceladas cuentan como "agendó". Para un aviso de servicio
  // suelen contar; para una promoción a clientes, no.
  targetIncludeCancelled Boolean @default(false)
  // Invierte el filtro de citas: "los que NO agendaron esto". Es lo que sirve
  // para captación, que suele ser lo que una promoción realmente quiere.
  targetNegate           Boolean @default(false)

  status MessageStatus @default(DRAFT)
  sentAt DateTime?

  // Foto del alcance en el momento del envío. Se congela: si alguien edita su
  // perfil después, el mensaje que ya recibió no se le quita.
  recipientCount Int @default(0)
  pushSent       Int @default(0)

  // Id del User admin que lo creó. Plano por diseño, como en Carousel.
  createdBy String

  recipients AdminMessageRecipient[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, sentAt])
}

model AdminMessageRecipient {
  id        String       @id @default(cuid())
  messageId String
  message   AdminMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Audiencia con la que entró en el reparto, para poder auditar por qué le
  // llegó. Null cuando el envío fue general.
  audience String?

  readAt DateTime?

  createdAt DateTime @default(now())

  @@unique([messageId, userId])
  @@index([userId, readAt])
  @@index([messageId])
}

/// Tipo de cambio del dólar, uno por día.
///
/// Existe porque ONVO cobra su fijo por transacción en dólares y la liquidación
/// llega con SU tipo de cambio: sin guardar el que se usó, la diferencia no se
/// puede explicar. Se guarda la fuente además del valor, porque no es lo mismo
/// el dato oficial del BCCR que uno cargado a mano o un respaldo de mercado.
model ExchangeRate {
  id   String   @id @default(cuid())
  /// Día al que corresponde, a medianoche en hora de Costa Rica.
  date DateTime @unique @db.Date

  /// Precio de venta: es el que corresponde a un costo que se paga en dólares.
  sell Decimal  @db.Decimal(12, 4)
  /// Precio de compra. Se guarda por completitud contable.
  buy  Decimal? @db.Decimal(12, 4)

  /// BCCR | HACIENDA | MANUAL | FALLBACK
  source    String   @db.VarChar(16)
  /// Quién lo cargó, cuando fue a mano.
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([date])
}

/// Cada vez que una persona acepta el acuerdo de atención.
///
/// Es la prueba del consentimiento expreso que pide la Ley 8968 para datos de
/// salud, así que es append-only: nunca se actualiza ni se borra una fila. Si el
/// texto del acuerdo cambia, sube VERSION_ACUERDO y se pide aceptar de nuevo; lo
/// aceptado antes sigue siendo válido para lo que pasó antes.
///
/// `contexto` dice en qué momento del recorrido se aceptó, que es justamente lo
/// que hace pedagógica a la secuencia: al registrarse, al empezar el proceso con
/// un profesional, y al repasar después de un tropiezo. Ver lib/acuerdo.
model AceptacionAcuerdo {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  version  String @db.VarChar(16)
  /// REGISTRO | SEGUNDA_CITA | REPASO_TRAS_MULTA | REPASO_TRAS_AUSENCIA
  contexto String @db.VarChar(32)

  ip        String?  @db.VarChar(64)
  userAgent String?  @db.Text
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([contexto])
}

/// Bitácora de intentos de volver a enganchar a alguien que faltó.
///
/// Existe para que "se le escribió" deje de ser un recuerdo de quien atendió. Es
/// también el requisito de una baja por abandono: no se da de baja por abandono
/// a quien nadie contactó (ver lib/casos).
model ContactoReenganche {
  id String @id @default(cuid())

  patientId String
  patient   User   @relation("ContactosDelPaciente", fields: [patientId], references: [id], onDelete: Cascade)

  /// Cita que se perdió y originó el reenganche. Se conserva si la cita se borra.
  appointmentId String?

  /// EMAIL | WHATSAPP | LLAMADA | PRESENCIAL
  canal String @db.VarChar(16)
  /// Distingue el correo que sale solo de lo que hizo una persona.
  automatico Boolean @default(false)
  /// 0 = el mismo día, 1 = a los tres días, 2 = a los diez.
  intento Int @default(0)

  /// SIN_RESPUESTA | RESPONDIO | REAGENDO | NO_CONTINUA
  resultado String? @db.VarChar(24)
  nota      String? @db.Text

  /// Quién lo registró. Null cuando lo hizo el sistema.
  registradoPor String?

  createdAt DateTime @default(now())

  @@index([patientId, createdAt])
  @@index([appointmentId])
}

/// Registro ADMINISTRATIVO de un proceso de atención.
///
/// Esto no es un expediente clínico y no debe convertirse en uno. El expediente
/// le pertenece a la persona y a su profesional, y su custodia es obligación del
/// profesional colegiado (CPPCR, arts. 21 y 22). La plataforma se ocupa de la
/// parte administrativa: cuándo empezó un proceso, cuándo terminó y bajo qué
/// categoría.
///
/// Por eso acá NO hay campos de evolución, estado ni recomendaciones. Si alguna
/// vez se agrega un campo de texto libre a este modelo, se está abriendo la
/// puerta a que entre contenido clínico a una base que no corresponde: el cierre
/// se declara con categorías y atestaciones, no con relato.
///
/// El visado de la dirección clínica es un control del negocio —protege a la
/// empresa y al profesional de un cierre mal documentado—, no una supervisión
/// clínica: con quién y cada cuánto supervisa su práctica lo decide cada
/// profesional.
///
/// Las relaciones son Restrict y no Cascade por integridad contable: un proceso
/// que generó cobros no puede desaparecer en cascada. Por lo mismo se guarda
/// copia congelada del nombre y la cédula.
model Caso {
  id String @id @default(cuid())

  patientId String
  patient   User   @relation("CasosDelPaciente", fields: [patientId], references: [id], onDelete: Restrict)

  professionalId String
  professional   ProfessionalProfile @relation("CasosDelProfesional", fields: [professionalId], references: [id], onDelete: Restrict)

  pacienteNombre String  @db.VarChar(120)
  pacienteCedula String? @db.VarChar(32)

  /// ABIERTO | PENDIENTE_VISADO | CERRADO
  estado    String   @default("ABIERTO") @db.VarChar(24)
  abiertoAt DateTime @default(now())

  /// ALTA | BAJA. Resumen de `tipoCierre`, para listar sin interpretar.
  resultado String? @db.VarChar(8)
  /// ALTA_POR_OBJETIVOS | ALTA_CON_SEGUIMIENTO | BAJA_POR_ABANDONO |
  /// BAJA_A_SOLICITUD | BAJA_POR_DERIVACION | BAJA_POR_CRITERIO_PROFESIONAL
  tipoCierre String? @db.VarChar(32)

  cierrePropuestoAt DateTime?
  cerradoAt         DateTime?

  /// Atestaciones del profesional al cerrar. Son declaraciones, no relato: es
  /// lo que protege a la empresa y a él mismo si mañana alguien pregunta.
  personaInformada       Boolean @default(false)
  registradoEnExpediente Boolean @default(false)

  /// A quién se deriva, cuando el cierre es una derivación. Solo el destino:
  /// las indicaciones son del expediente, y el expediente no vive acá.
  derivadoA String? @db.VarChar(200)

  visadoPorId String?
  visadoPor   User?     @relation("CasosVisados", fields: [visadoPorId], references: [id], onDelete: SetNull)
  visadoAt    DateTime?
  visadoNota  String?   @db.Text

  /// cerradoAt + 10 años.
  ///
  /// Es una decisión comercial de conservación del registro administrativo, no
  /// la custodia del expediente: esa es del profesional colegiado y ocurre fuera
  /// de esta base. Se eligió el mismo plazo para que ambos rastros duren igual.
  conservarHasta DateTime?

  /// Cuando alguien retoma, no se reabre el caso cerrado: se abre uno nuevo que
  /// apunta al anterior. Un registro cerrado deja de moverse.
  casoAnteriorId String? @unique
  casoAnterior   Caso?   @relation("CasoRetomado", fields: [casoAnteriorId], references: [id], onDelete: SetNull)
  casoSiguiente  Caso?   @relation("CasoRetomado")

  notas   CasoNota[]
  eventos CasoEvento[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // No hay unique de "un caso abierto por pareja": Postgres no lo expresa sin
  // índice parcial y Prisma no lo modela. Lo garantiza abrirCasoSiNoExiste, que
  // es el único camino que crea casos.
  @@index([professionalId, estado])
  @@index([patientId, estado])
  @@index([estado])
}

/// Observaciones de la dirección clínica cuando devuelve un cierre.
///
/// Append-only. Es texto administrativo entre la dirección y el profesional
/// —qué falta para poder visar—, no contenido sobre la persona atendida.
model CasoNota {
  id     String @id @default(cuid())
  casoId String
  caso   Caso   @relation(fields: [casoId], references: [id], onDelete: Restrict)

  /// OBSERVACION_DIRECCION
  tipo  String @db.VarChar(24)
  texto String @db.Text

  autorId String?
  autor   User?   @relation("NotasDelAutor", fields: [autorId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@index([casoId, createdAt])
}

/// Bitácora del registro administrativo, incluidas las lecturas de la dirección
/// clínica.
///
/// Se anota quién abrió qué y cuándo aunque lo que haya acá sean categorías y
/// fechas: es el hábito que hace que el día que se agregue algo más sensible ya
/// exista el rastro.
model CasoEvento {
  id     String @id @default(cuid())
  casoId String
  caso   Caso   @relation(fields: [casoId], references: [id], onDelete: Restrict)

  /// APERTURA | CIERRE_PROPUESTO | VISADO | VISADO_DEVUELTO | REAPERTURA |
  /// LECTURA_DIRECCION_CLINICA | COPIA_SOLICITADA
  tipo   String  @db.VarChar(32)
  detalle String? @db.Text

  actorId String?
  actor   User?   @relation("EventosDelActor", fields: [actorId], references: [id], onDelete: SetNull)

  createdAt DateTime @default(now())

  @@index([casoId, createdAt])
  @@index([tipo])
}
```

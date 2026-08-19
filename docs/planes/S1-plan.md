# S1 · Metadatos heredados y sitemap

**Estado:** aprobado e **implementado** el 2026-08-19. Ver §8, resultado real.
**Rama:** `fix/seo-geo` (sobre `06aa3aa`, cierre de S0).
**Hallazgos:** H-01, H-05, H-15, H-16, H-17, H-26, H-06, H-07, H-08.
**Riesgo:** bajo. No toca URLs, no toca la base, no hay migración.

---

## 1. Reconocimiento: qué encontré y en qué difiere de la auditoría

Todo lo que la auditoría afirma sobre estos nueve hallazgos **sigue siendo cierto al 2026-08-19**. Las líneas citadas coinciden. Pero el reconocimiento devolvió tres cosas que la auditoría no dice, y dos de ellas cambian el alcance.

### 1.1 El canónico heredado alcanza a mucho más que las páginas legales

La auditoría cuenta 4 páginas legales canonicalizando a la home. El arnés de S0 encontró **7 URLs públicas** en ese estado, y el mapeo de rutas muestra que el problema es más grande todavía, porque afecta a toda ruta que no declare `alternates` propio:

| Ruta | Estado hoy | Consecuencia |
|---|---|---|
| `/faq`, `/terminos` | `metadata` sin `alternates` | canónico → home |
| `/privacidad`, `/cookies` | sin `metadata` alguno | canónico → home, y sin título propio |
| `/registro`, `/registro/profesional`, `/registro/usuario` | `"use client"`, no pueden exportar `metadata` | canónico → home |
| `/espera-aprobacion` | `metadata` sin `alternates` | canónico → home |
| `/ingresar`, `/recuperar`, `/cambiar-password`, `/verificar-email` | sin `metadata` | canónico → home |
| `/blog/preview/[id]` | sin `metadata` | canónico → home |
| **las 46 rutas de `/panel/*`** | `src/app/panel/layout.js` no declara `metadata` | **todas canonicalizan a la home** |
| `/mi/*` | `src/app/mi/layout.js` tiene `metadata` sin `alternates` ni `robots` | canónico → home |

Las de `/panel` y `/mi` están detrás de guard de sesión, así que un crawler recibe la redirección antes que el HTML. No es una emergencia. Pero significa que quitar `alternates.canonical` del layout raíz —que es lo que pide H-01— deja a esas rutas **sin canónico en lugar de con uno equivocado**, que es mejor pero no es lo correcto. Lo correcto es `robots: noindex` explícito, que es además lo que el plan pide.

Alcance real de H-01, entonces: no son 4 páginas, son 4 páginas que necesitan canónico propio y ~55 rutas que necesitan `noindex`. La buena noticia es que las ~55 se resuelven con dos `layout.js`.

### 1.2 `/og-image.png` devuelve 404 en producción

Ya quedó anotado en S0-plan.md. Lo repito acá porque bloquea la parte de S1 que corresponde a H-05: el layout declara `og:image` y `twitter:image` apuntando a `/og-image.png`, `src/lib/seo.js:22` lo usa como `DEFAULT_OG_IMAGE` para toda entidad sin imagen propia, y **el archivo no existe**. Verificado con `curl`: 404.

No es una mejora pendiente de identidad de marca. Es la vista previa rota de todo lo que se comparte del sitio en WhatsApp, Instagram, Facebook y LinkedIn, hoy.

Sigue bloqueado por **D1**: no puedo decidir qué muestra la imagen.

### 1.3 `/agendar/[id]` declara canónico propio, y el plan pide bloquearlo

`src/app/agendar/[id]/page.js:11` construye `siteUrl('agendar/{id}')` como canónico, es decir, se declara indexable. El plan de S1 pide agregar `/agendar/` al `disallow` del `robots.txt`.

No es contradictorio, es una corrección: esas páginas son una segunda versión del perfil profesional, con URL de cuid opaco, y compiten con `/profesionales/{slug}` por la misma consulta. Bloquearlas es lo correcto —y S9 va justamente en esa dirección, al reapuntar el botón «Ver Perfil» de `/agendar/{id}` a `/profesionales/{slug}`—. Lo dejo asentado para que la decisión sea consciente y no un efecto colateral.

---

## 2. Archivos

### Se modifican (10)

| Archivo | Cambio |
|---|---|
| `src/app/layout.js` | quitar `alternates.canonical`, `keywords` y `openGraph.url` |
| `src/app/robots.js` | ampliar `disallow` |
| `src/app/sitemap.js` | `revalidate`, `catch` que falla, filtro de perfiles, sacar `/registro*` |
| `src/app/faq/page.js` | `metadata` → `buildMetadata` |
| `src/app/terminos/page.js` | `metadata` → `buildMetadata` |
| `src/app/privacidad/page.js` | agregar `metadata` |
| `src/app/cookies/page.js` | agregar `metadata` |
| `src/app/espera-aprobacion/page.js` | `metadata` con `noindex` |
| `src/app/blog/serie/[slug]/page.js` | agregar `openGraph` propio |
| `src/app/mi/layout.js` | agregar `robots: noindex` |

### Se crean (3)

| Archivo | Para qué |
|---|---|
| `src/app/registro/layout.js` | `noindex` para las tres rutas de registro, que son `"use client"` |
| `src/app/panel/layout.js` → se le agrega `metadata` | ya existe, se le suma el export |
| `src/app/blog/preview/layout.js` | `noindex` para la previsualización |

Y los de sesión, que no tienen layout propio y son rutas hoja sueltas: `/ingresar`, `/recuperar`, `/cambiar-password`, `/verificar-email`. Son cuatro archivos `page.js` sin `metadata`; tres son `"use client"` o no exportan nada. **Propongo un solo `layout.js` no es posible** —están en la raíz de `app/`, un layout ahí sería el raíz—. Van cuatro `layout.js` de tres líneas cada uno, uno por carpeta. Es feo y es la forma que Next ofrece.

### Se borran

Ninguno.

### Migraciones de base de datos

Ninguna. S1 no toca el schema.

---

## 3. Diff conceptual, cambio por cambio

### H-01 · Canónico heredado — `src/app/layout.js`

**Sale:** la línea `alternates: { canonical: BASE_URL },`.

**Por qué:** en Next, `alternates.canonical` del layout raíz se hereda por toda ruta que no lo redefina. El resultado es que decenas de URLs le declaran a Google «la versión buena de esta página es la home». Es la instrucción más fuerte que existe para pedir que una página *no* se indexe por sí misma.

**Entra:** canónico propio en `/faq`, `/terminos`, `/privacidad`, `/cookies` vía `buildMetadata`, que ya resuelve `alternates`, `openGraph` y `twitter` de una vez (`src/lib/seo.js:74-112`). No escribo el objeto a mano en cuatro lugares.

### H-16 · `og:url` heredado

**Sale:** `openGraph.url` del layout raíz. Mismo mecanismo, mismo problema: cada página comparte con la URL de la home.

**Entra:** `openGraph` propio en `src/app/blog/serie/[slug]/page.js`. Hoy su `generateMetadata` define `alternates.canonical` pero no `openGraph`, así que hereda. Las demás rutas ya pasan por `buildMetadata`.

El resto del bloque `openGraph` del layout (`type`, `locale`, `siteName`, `title`, `description`, `images`) **se queda**: son valores por defecto legítimos para una ruta que no defina los suyos. Lo único que no puede heredarse es la URL.

### H-15 · `keywords`

**Sale:** el arreglo entero de `src/app/layout.js:60-68`.

**Por qué:** Google dejó de usar la etiqueta hace más de una década y las mismas siete palabras en todas las páginas no aportan nada. El valor actual incluye `coaching bienestar`, que además contradice la línea del proyecto. No se reemplaza: se elimina.

`buildMetadata` acepta `keywords` como parámetro opcional (`src/lib/seo.js:108`) y ninguna página lo usa. **No toco esa firma** —es de S15 si acaso—, solo dejo de emitir el valor global.

### H-17 · Páginas sin metadatos

- `privacidad` y `cookies`: `export const metadata = buildMetadata({ title, description, path })`. Título y descripción escritos para lo que la página realmente dice.
- `registro/*`: `src/app/registro/layout.js` server-side con `robots: { index: false, follow: false }`. Los tres `page.js` siguen siendo `"use client"` y no se tocan.
- `espera-aprobacion`: `noindex`. Es una pantalla de estado de una cuenta.
- `panel/*`, `mi/*`, `blog/preview/*`, y las cuatro de sesión: `noindex` por layout.

**Sobre sacar `/registro*` del sitemap.** El comentario de `src/app/robots.js:8-9` dice explícitamente que `/registro*` queda indexable *a propósito*, por ser páginas de captación. El plan pide lo contrario. Me quedo con el plan —son formularios detrás de los cuales no hay contenido, y la captación la hace `/servicios` y `/profesionales`— pero **borro también ese comentario**, para que el código no siga afirmando una decisión que ya no rige.

### H-26 · robots.txt

**Entra en `disallow`:** `/mi/`, `/blog/preview/`, `/agendar/`, `/cambiar-password`, `/recuperar`, `/verificar-email`.
**Se queda:** `/api/`, `/panel/`, `/ingresar`.
**No entra nada contra crawlers de IA.** El bloque `*` sigue permisivo. `GPTBot`, `ClaudeBot`, `PerplexityBot` y `Google-Extended` mantienen acceso completo: es la premisa de toda la estrategia GEO y no se toca.

### H-06 · Sitemap congelado

**Entra:** `export const revalidate = 3600;` en `src/app/sitemap.js`.

**Por qué:** sin eso, Next resuelve el sitemap en build y lo sirve estático hasta el siguiente despliegue. Un artículo publicado un martes no aparece hasta que alguien despliegue.

**Verificación específica:** después del build, la ruta `/sitemap.xml` no debe figurar con `revalidate: false` en `.next/`. Comando en §6.

### H-07 · Sitemap silencioso

**Sale:** el `catch {}` vacío de `src/app/sitemap.js:44-46`.
**Entra:** un `catch` que registra el error y **relanza**.

**Por qué:** hoy, si Prisma falla, el sitemap se genera con las diez rutas estáticas y sin un solo artículo, servicio ni perfil, y nadie se entera. Un sitemap que se vacía en silencio es peor que un build roto: el build roto se ve.

**Efecto colateral que hay que aceptar:** el build pasa a depender de la base. El comentario actual dice «si la DB no está disponible en build time». Verifiqué que la conexión funciona desde local. Si el build de Vercel corre sin `DATABASE_URL` accesible, este cambio lo rompe — y eso es exactamente lo que se busca que pase, porque hoy ese mismo escenario produce un sitemap vacío desplegado a producción.

### H-08 · Perfil inactivo en el sitemap

**Entra:** `user: { is: { isActive: true } }` en el `where` de `professionalProfile.findMany` (`src/app/sitemap.js:35-38`), alineándolo con `src/app/profesionales/[slug]/page.js:26-30`, que ya filtra así.

**Verificado en producción:** el sitemap publica hoy `/profesionales/mariano-zorrilla`, y esa URL **devuelve 404**. Estamos entregándole a Google una URL rota en el archivo cuya única función es decirle qué URLs existen.

### H-05 · Imagen social — **BLOQUEADO POR D1**

No implemento nada de esto. Ver §5.

---

## 4. Efectos colaterales identificados

| Qué se toca | Qué depende | Riesgo |
|---|---|---|
| `alternates` del layout raíz | toda ruta sin `alternates` propio | Las rutas privadas quedan sin canónico hasta que el `noindex` las cubra. Por eso ambos cambios van en el mismo commit, no en dos. |
| `keywords` del layout | nada. Ninguna página lo lee | nulo |
| `catch` del sitemap | el build entero | **el más alto de S1.** Si Vercel no llega a la base durante el build, el despliegue falla. Es deliberado. |
| filtro de perfiles | el sitemap pierde 1 entrada (39 → 38, menos las 3 de registro = 35) | nulo |
| `/registro*` fuera del sitemap | contradice el comentario de `robots.js`, que se borra | nulo |
| `robots.js` con `/agendar/` | `/agendar/[id]` deja de rastrearse pese a declarar canónico propio | bajo, y buscado |
| `metadata` en `panel/layout.js` | el layout hoy solo devuelve `children`; agregar un export no cambia el render | nulo |
| `robots` en `mi/layout.js` | la PWA de pacientes; el layout ya declara `manifest` y `appleWebApp`, que no se tocan | nulo |

---

## 5. Lo que NO se hace en S1

- **H-05 / imagen social.** Bloqueado por **D1**. Hay que decidir: archivo estático `public/og-image.png` o generación con `src/app/opengraph-image.js`, y qué muestra. Mientras tanto la URL sigue devolviendo 404. **Es lo más visible que S1 deja sin arreglar y depende de una respuesta, no de código.**
- **No se toca ningún slug.** Eso es S4-S6.
- **No se toca `src/lib/seo.js`.** El `clampText` que corta once excerpts es H-37, y es de S12.
- **No se unifica `SITE_URL`.** Las cuatro variables de entorno son H-27, de S15.
- **No se toca el JSON-LD.** El grafo es S8.
- **No se crea `/profesionales`** aunque los breadcrumbs apunten ahí. Es H-10, de S9.
- **No se refactoriza nada de paso.** `src/app/faq/page.js` tiene 4 pares de FAQ en JSON-LD que no aparecen en pantalla — no, eso es `servicios/page.js`, H-20, S10. En `faq/page.js` no toco más que el bloque `metadata`.

---

## 6. Verificación

```bash
# 1. Build limpio. Es donde aparecería un error de import o de sintaxis.
npm run build

# 2. El sitemap dejó de ser estático (H-06). No debe aparecer 'revalidate: false'
#    para la ruta /sitemap.xml en el manifest de Next.
grep -o '"/sitemap.xml"[^}]*' .next/prerender-manifest.json .next/app-path-routes-manifest.json 2>/dev/null

# 3. Arnés contra el servidor local, comparando con el baseline de S0.
npm start &
node scripts/verify-seo.mjs docs/backups/urls-produccion-2026-08-19.txt \
  --base http://localhost:3000 \
  --diff docs/backups/baseline-tecnico-2026-08-19.json
```

**Criterios de aceptación, uno por hallazgo:**

| # | Criterio | Cómo se mide |
|---|---|---|
| H-01 | `canónico ajeno` pasa de **7 a 0** en el resumen del arnés | corrida local |
| H-01 | `/faq`, `/terminos`, `/privacidad`, `/cookies` tienen canónico igual a su propia URL | corrida local |
| H-15 | `<meta name="keywords">` no aparece en ninguna página | `curl -s localhost:3000 \| grep -c 'name="keywords"'` → 0 |
| H-16 | `/blog/serie/{slug}` emite `og:url` igual a su canónico | requiere una serie en la base; **la taxonomía está vacía (H-13)**, así que este criterio **no se puede verificar contra datos reales**. Se verifica leyendo el HTML de la ruta con una serie insertada a mano en local, o queda declarado como no verificado |
| H-17 | `/privacidad` y `/cookies` tienen `<title>` propio | corrida local |
| H-17 | `/registro`, `/registro/*` emiten `noindex` | corrida local |
| H-26 | `/robots.txt` contiene las 6 reglas nuevas y **ninguna** directiva contra crawlers de IA | `curl -s localhost:3000/robots.txt` |
| H-06 | `/sitemap.xml` no está marcado `revalidate: false` | comando 2 |
| H-07 | con `DATABASE_URL` inválida, `npm run build` **falla** | prueba deliberada con env alterada, en local |
| H-08 | `/sitemap.xml` no contiene `mariano-zorrilla` | `curl -s localhost:3000/sitemap.xml \| grep -c mariano` → 0 |
| H-08 | el sitemap baja de 39 a 35 entradas (−1 perfil inactivo, −3 registro) | `grep -c '<loc>'` |
| H-05 | — | **no verificable: bloqueado por D1** |

El criterio de H-16 y el de H-05 son los dos que S1 **no** puede cerrar por sí solo. Quedan declarados como tales, no se dan por buenos.

---

## 7. Definición de terminado

Commit `fix(seo): S1 — metadatos heredados y sitemap`, cuerpo listando H-01, H-06, H-07, H-08, H-15, H-16, H-17, H-26 como cerrados y H-05 como abierto por D1. Este documento se actualiza con el resultado real de la verificación. Y se detiene.

---

## 8. Resultado real de la ejecución

Aprobado y ejecutado el 2026-08-19. Build limpio. Arnés: **39 de 40 URLs sin observaciones**.

### Criterios, uno por uno

| # | Criterio | Resultado |
|---|---|---|
| H-01 | `canónico ajeno` de 7 a 0 | **7 → 0** |
| H-01 | `/faq`, `/terminos`, `/privacidad`, `/cookies` con canónico propio | cumplido |
| H-06 | `/sitemap.xml` deja de ser estático | cumplido — el build lo reporta con `1h` de revalidación |
| H-07 | con base inalcanzable, el build falla | cumplido — sale con código 1 y nombra `/sitemap.xml` |
| H-08 | `mariano-zorrilla` fuera del sitemap | cumplido — 0 apariciones |
| H-08 | el sitemap baja de 39 entradas | **39 → 36** |
| H-15 | sin `<meta name="keywords">` | cumplido — 0 apariciones |
| H-16 | `og:url` propio por página | cumplido en todas las rutas verificables |
| H-16 | `/blog/serie/{slug}` | **no verificado**, ver abajo |
| H-17 | `/privacidad` y `/cookies` con título propio | cumplido |
| H-17 | `/registro*` con `noindex` | cumplido — `noindex, nofollow` en las tres |
| H-26 | 6 reglas nuevas en `robots.txt`, ninguna contra IA | cumplido — 0 directivas contra crawlers de IA |
| H-05 | imagen social | **cerrado después**, con D1 resuelta — ver HN-01 |

### Diferencias respecto de lo planificado

**El sitemap quedó en 36, no en 35.** El plan restaba 3 rutas de registro; solo había 2 en el sitemap (`/registro` y `/registro/profesional` — `/registro/usuario` nunca estuvo). 39 − 2 − 1 = 36.

**Cuatro layouts se volvieron uno.** El plan asumía que `/ingresar`, `/cambiar-password`, `/verificar-email` y `/recuperar` necesitaban un `layout.js` cada uno. Al leerlos, los tres primeros son server components y exportan `metadata` directo. Solo `/recuperar` es `"use client"` y necesita layout.

**`/registro*` no se bloquea en `robots.txt`,** contra lo que decía el plan. Esas rutas están hoy indexadas —las publicaba el sitemap— y bloquearlas por robots impediría que el crawler leyera el `noindex` que ahora declaran: quedarían indexadas para siempre como «bloqueada por robots.txt». Primero tienen que poder rastrearse para salir del índice. Están fuera del sitemap y con `noindex`, que es lo que corresponde ahora.

**Se corrigió el arnés de S0.** Comparaba canónicos por URL completa, así que con `--base http://localhost:3000` marcaba las 40 como rotas: la petición va a localhost pero el canónico declara producción, que es lo correcto. Ahora compara por ruta. Además dejó de exigirles canónico y JSON-LD a las páginas `noindex` —era reportar como defecto justamente lo que se buscaba— y el resumen separa públicas de no indexables.

### Lo que quedó abierto

**H-05 · imagen social.** ~~Bloqueado por D1.~~ **Cerrado el 2026-08-19**, una vez tomada D1: imagen generada por página en `src/app/og/route.js`. Detalle completo en `docs/hallazgos-nuevos.md`, HN-01.

**H-16 en `/blog/serie/{slug}`.** No verificable: la taxonomía está vacía en producción (0 series, 0 temas, 0 disciplinas — H-13). El `openGraph` propio está implementado y el build compila la ruta, pero no hay un slug real contra el cual comprobarlo, y S1 no escribe en producción. Se verifica en S11, cuando haya series cargadas. **No se da por bueno.**

### Hallazgos nuevos

Tres más, anotados en `docs/hallazgos-nuevos.md` sin arreglar (HN-02, HN-03, HN-04). El que importa: **la home y `/servicios` se tragan los errores de base en silencio y se prerenderizan vacías**, que es el mismo patrón de H-07 en dos rutas más. Si esa degradación es deliberada, es una decisión que no me toca revertir.

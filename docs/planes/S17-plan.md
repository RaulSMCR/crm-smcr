# S17 — Indexación: enlaces internos y URLs viejas del blog

Origen: informe de Search Console del 2026-11-10 (sin indexar: 20 descubiertas, 11 rastreadas).
Estado: **fase 2 (plan). Espera aprobación de Raúl.**

## Diagnóstico verificado

| Punto del informe | Qué encontré |
|---|---|
| Home y menú no enlazan `/ansiedad` ni el hub | Confirmado. Ni `src/app/page.js` ni `Header.js` ni `Footer.js` enlazan `/ansiedad`, el hub `/raul-olmedo-evans` ni `/blog/que-es-psicoterapia-y-como-orientarse-entre-escuelas`. El pie solo enlaza `/ayuda-inmediata`. El perfil `/profesionales/raul-olmedo` tampoco enlaza el hub. |
| Los artículos enlazan poco al tema | Solo los 3 ensayos de la angustia llevan el chip «Ansiedad» (`ArticleTaxonomy`). Los otros 16 artículos no apuntan ni a `/ansiedad` ni al hub. |
| `/ansiedad` | Publicado, con 3 artículos aprobados. Ya cumple la condición editorial para nombrarlo («hay artículos detrás»). |
| 404 del blog | Las 4 URLs viejas (`parte-i-genealog-a…`, `parte-ii-salud-menta…`, `parte-iii-l-neas-abiertas…`, `parte-2-c-mo-se-volvi-pensable…`) **no tienen fila en `SlugRedirect`**. Ya no existían en el respaldo del 19-ago: el renombre es anterior a S0 y nadie dejó redirección. |
| Por qué se rompieron | `updateAdminPost` (`src/actions/admin-actions.js`) recalcula el slug a partir del título en cada guardado y no registra redirección (asimetría anotada el 16-sep). Mientras no se repare, cualquier edición de título vuelve a dejar un 404. |
| `/profesionales/mariano-zorrilla` | Es una baja: el 404 es el resultado buscado. Se deja así. |

## Correspondencia propuesta para los 404 (decisión de Raúl: D14)

La evidencia es el script `backfill-blog-taxonomy.mjs` antes y después de `281816b`: la serie «Genealogía del concepto de salud mental» tenía 4 entregas en este orden: introducción, Parte I, Parte II y Parte III. Hoy tiene 4 capítulos, y la introducción ya redirige al capítulo 1. Los 5 artículos creados el 2026-05-06 son los 4 capítulos más «Lógicas comunes», así que las Partes I a III son los mismos registros, renombrados.

| URL vieja | Destino propuesto | Confianza |
|---|---|---|
| `/blog/parte-i-genealog-a-del-concepto-de-salud-mental` | `/blog/mundo-encerro-locura-nacimiento-clinica` (cap. 2) | Media: por posición |
| `/blog/parte-ii-salud-menta-definiciones-disciplinarias-en-tensi-n` | `/blog/siglo-xx-palabra-pastilla-codigo` (cap. 3) | Media: por posición |
| `/blog/parte-iii-l-neas-abiertas-y-horizontes-contempor-neos-de-la-salud-mental` | `/blog/oms-consagracion-global-salud-mental-alma-ata` (cap. 4) | Media: por posición |
| `/blog/parte-2-c-mo-se-volvi-pensable-la-salud-mental` | `/blog/la-salud-mental-despues-de-las-luces` («Del alma atribulada… II») | Baja: por tema |

Si alguno no corresponde, se lo apunta a la página de su serie.

## Cambios

1. **Redirecciones** (datos): 4 filas en `SlugRedirect` (`entityType = 'post'`), que ya se leen en el camino del 404 y emiten 308. No hace falta código ni migración.
2. **Que no se repita** (código): `updateAdminPost` lee el slug anterior y, si cambia, llama a `registrarRedirect(TIPOS.post, anterior, nuevo, tx)` en la misma transacción, igual que `topic-actions.js`. Con prueba.
3. **Home** (código y copy, D15): una franja «Para entender» entre el blog y el equipo, con tres entradas:
   - **Ansiedad y angustia** → `/ansiedad`
   - **Qué es psicoterapia y cómo orientarse entre escuelas** → el artículo
   - **Consultar con Raúl Olmedo** → `/raul-olmedo-evans` (el hub con sus temas)
4. **Menú** (D15): agregar «Temas» en el encabezado y en el pie, apuntando a `/ansiedad` mientras sea el único tema publicado. La alternativa es no tocar el menú y dejar solo la franja de la home.
5. **Artículos**: un bloque fijo al pie de cada artículo, «Seguir leyendo», con `/ansiedad` y la guía de psicoterapia (omitiendo la propia). Sale de datos, no se escribe a mano por artículo.
6. **Perfil de Raúl**: enlace «Temas de consulta» hacia `/raul-olmedo-evans` en `/profesionales/raul-olmedo`.
7. **Después del despliegue** (Raúl, en Search Console → Inspección de URLs), en este orden, hasta 10 por día: `/ansiedad`, `/raul-olmedo-evans/terapia-para-la-ansiedad`, `/blog/que-es-psicoterapia-y-como-orientarse-entre-escuelas`, `/ayuda-inmediata`, los otros 3 temas del hub, la serie de la angustia y sus artículos.

## Fuera de alcance
- `/profesionales/mariano-zorrilla` (baja, 404 buscado).
- El `.woff2` y las URLs viejas que ya redirigen.
- Taxonomía de los temas en borrador (`psicoanalisis`, `diagnostico-y-dsm`): siguen sin publicar. Es S11.

## Riesgos
- Una correspondencia mal elegida manda a Google a una página que no es la misma; un 308 no se deshace rápido en el índice. Por eso D14.
- La franja de la home nombra «ansiedad». Cumple la regla editorial porque `/ansiedad` tiene artículos, pero `tests/unit/metadata-og.test.js` vigila títulos y descripciones, no el cuerpo: lo reviso con la vista previa.

## Verificación
`pnpm run lint`, `pnpm test`, `pnpm run build`. Tras el despliegue, `scripts/verify-seo.mjs`: los 4 slugs viejos tienen que dar 308 al destino y la home tiene que contener los 3 enlaces nuevos.

## Cierre (2026-11-10)

Aprobado por Raúl: D14 tal como estaba propuesto y D15 con «Temas» en el menú.

- **Redirecciones:** 4 filas en `SlugRedirect` (ids `s17-…`), con los destinos verificados como PUBLISHED. La Parte III ya responde 308. Las otras tres seguían sirviendo un 404 guardado en la caché ISR (`revalidate = 3600`); se refrescan solas en menos de una hora o con el despliegue.
- **Que no se repita:** `registrarCambioDeSlug` (`src/lib/slug-redirect.js`) se aplica en la misma transacción en los dos lugares que cambian el slug de un artículo: `updateAdminPost` y `PATCH /api/professional/posts/[id]`. Si un artículo vuelve a un nombre anterior, se borra esa redirección para no armar un ciclo.
- **Home, artículos y menú:** `src/lib/enlaces-de-lectura.js` ofrece solo lo publicado. Lo usan la franja «Para entender» de la home y el bloque «Seguir leyendo» al pie de cada artículo, que no se ofrece a sí mismo. «Temas» va en `PublicHeader` y en el pie (`src/lib/tema-del-menu.js`).
- **Distinto de lo previsto:** el perfil de Raúl ya enlazaba el hub (`getPublishedHubForProfile`), así que el punto 6 no hizo falta. `src/components/Header.js` era código muerto (el layout usa `PublicHeader`) y se borró.
- **Verificado en el build:** la home trae 3 enlaces a `/ansiedad` (franja, menú y pie), la guía y el hub. Los artículos traen «Seguir leyendo».

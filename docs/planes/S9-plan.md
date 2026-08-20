# S9 · Conexión artículo ↔ autor e índice de equipo

**Estado:** ejecutado el 2026-08-20.
**Hallazgos:** H-09, H-10.
**Riesgo:** medio. Cambia una URL pública indexada.

---

## 1. D9: `/profesionales` es el índice, `/nosotros` redirige

Los breadcrumbs de los perfiles ya apuntaban a `/profesionales`, **una URL que no
existía**: declaraban un 404 en el marcado. Y `/nosotros` era, en los hechos, el
índice del equipo.

Se resolvió moviendo el índice a `/profesionales` y redirigiendo `/nosotros` con
un 308 permanente, declarado en `next.config.mjs`. No va por la tabla
`SlugRedirect`: esa es para slugs de entidad, y esto es una ruta estática.

`/nosotros` estaba en el sitemap y probablemente indexada, así que se quema esa
URL a cambio de una más descriptiva. Es el costo que la opción elegida traía.

Se actualizaron los siete lugares que la enlazaban: sitemap, header, header
público, footer, el «volver al equipo» del perfil, el middleware y la lista de
rutas del panel de SEO.

---

## 2. H-09 · el botón llevaba al lugar equivocado

«Ver Perfil», al pie de cada artículo, apuntaba a `/agendar/{id}`. El lector que
quería saber **quién** escribía caía en un formulario de reserva.

Ahora apunta a `/profesionales/{slug}`, que es donde está la credencial
verificada — y es además el nodo al que el JSON-LD del artículo ya apuntaba como
autor desde S8. **El enlace visible acompaña ahora al enlace semántico**, que era
el punto del segmento: un grafo que el HTML no refleja es una afirmación que el
lector no puede comprobar.

### Bloque de autor al pie

Nombre, disciplina, colegio y matrícula, la bio, y dos salidas: su perfil y sus
otros artículos. Es en HTML lo mismo que el grafo ya decía en JSON-LD.

El bloque no se muestra si el autor no tiene slug. Y `blog/preview/[id]` recibió
los mismos campos en su consulta: usa el mismo componente, así que sin eso el
bloque habría salido a medias en la vista previa.

---

## 3. Verificación

| Criterio | Resultado |
|---|---|
| `/profesionales` responde y lista el equipo activo | **200**, 3 perfiles |
| `/nosotros` redirige | **308** → `/profesionales` |
| Ningún breadcrumb apunta a una ruta inexistente | cumplido |
| Desde un artículo se llega al perfil en un clic | cumplido |
| El sitemap publica `/profesionales` | cumplido |
| El `ItemList` del índice mudó su `@id` | `…/profesionales#equipo` |
| Grafo | 33 `@id`, 118 referencias, **0 rotas** |
| Suite | 676 tests |

---

## 4. Lo que NO se hizo

**No se escribió el relato del proyecto.** La opción elegida no lo pedía: `/nosotros`
redirige en vez de convivir. Si más adelante se quiere una página que explique
por qué el proyecto es interdisciplinario, será una ruta nueva y contenido nuevo,
no la recuperación de esta URL.

`/agendar/{id}` sigue existiendo y sigue bloqueada en `robots.txt` desde S1. S9
no la toca: dejó de ser el destino del enlace de autor, que era el problema.

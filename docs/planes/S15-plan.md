# S15 · Limpieza final

**Estado:** ejecutado el 2026-08-20.
**Hallazgos:** H-27, H-35, y HN-06.

---

## 1. H-27 no era lo que parecía

El plan lo describía como «cuatro variables de entorno para el mismo concepto».
Las cuatro apuntan al mismo valor, así que consolidarlas no arreglaba nada. **Lo
que estaba mal eran los fallbacks**, y cada uno fallaba distinto:

| Dónde | Qué hacía |
|---|---|
| `src/lib/qstash.js` | caía a `https://crm-smcr.vercel.app`, **un dominio distinto** del que el sitio usa en todo lo demás |
| `src/lib/google-oauth.js` | `process.env.NEXT_PUBLIC_BASE_URL + "/..."` sin fallback: si faltaba la variable, el `redirect_uri` quedaba en `undefined/panel/…` y Google rechazaba la autorización con un error que no dice qué pasó |
| tres lugares de correo | `|| ""`, que dentro de un correo deja un enlace **relativo**, sin página base contra la cual resolverlo |

Los siete usos pasan ahora por `site-url.js`, que ya aceptaba las cuatro
variables y tiene el dominio correcto como último recurso.

**No se tocaron las variables de entorno.** Consolidar el *uso* no exige tocar
Vercel; consolidar las *variables* sí, y hacerlo sin poder leer qué hay
configurado allá sería adivinar. El plan advertía justamente eso.

---

## 2. H-35 · se elimina `rating`

Verificado que las tres filas estaban en `NULL` antes de borrar la columna.

No se va por higiene sino por decisión: puntuar psicoterapeutas con una
estrellita es la lógica del macro-directorio, es dudosa en clínica, y compite en
el único eje donde un agregador siempre gana. **Un campo que sigue en el schema
es una invitación permanente a llenarlo.**

---

## 3. El arnés, actualizado

El inventario de S0 se había quedado viejo: seguía generando `/servicios/{cuid}` y
`/nosotros`. `scripts/seo-baseline-dump.mjs` ahora emite las URLs vigentes **más
las heredadas**, que salen de la tabla `SlugRedirect`.

Eso importa: sin las heredadas, el inventario solo prueba el presente, y una URL
compartida hace seis meses puede romperse sin que nadie se entere. **El fallo que
hay que vigilar no es que devuelvan 200, sino que algún día devuelvan 404.**

### Barrido final contra producción

```
59 URLs (vigentes + heredadas)
39 responden 200        (3 de ellas noindex, a propósito)
20 redirigen            (las URLs viejas, que es lo que deben hacer)
 0 rotas

públicas indexables: 36
  sin canónico 0 · canónico ajeno 0 · sin JSON-LD 0 · sin descripción 0
lang: es-CR
```

Comparado con el baseline de S0: 7 canónicos apuntando a la home → 0. Una URL
rota en el sitemap → ninguna. 40 URLs conocidas → 59, sin perder una sola.

---

## 4. Reporte de cierre

### Cerrado

S0 a S10 y S12 a S15. De los 43 hallazgos de la auditoría, quedan cerrados todos
los técnicos salvo los que se listan abajo.

Más seis hallazgos que la auditoría no tenía (HN-01 a HN-06), de los cuales
cuatro se repararon y dos quedaron anotados.

### Abierto por decisión técnica

**H-12 y H-34** — el fallback de imagen sigue siendo del lado del cliente.
Resolverlo en el servidor exigiría una petición HTTP por imagen en cada render.
Hoy no hay ninguna portada rota y quedó el comando para comprobarlo. Ver
`S13-plan.md`.

**Los otros 29 usos de `SafeImage`** siguen con `<img>`. Migrarlos es trabajo de
revisión visual, no de terminal.

### Abierto porque depende de trabajo editorial

Estas cifras son de hoy, sobre 15 artículos publicados:

| | |
|---|---|
| posts sin `metaDescription` | **13** |
| posts sin `metaTitle` | **13** |
| posts sin `focusKeyword` | **13** |
| posts sin `excerpt` | 2 |
| posts sin `coverImageAlt` | **15** |
| posts sin serie asignada | **15** |
| servicios sin `metaDescription` | **10** |
| perfiles sin `metaDescription` | 3 |
| disciplinas + temas + series | **0** |
| asignaciones de servicio | **0** |

- **H-13** — taxonomía vacía. **Bloquea S11 por completo**: no tiene sentido
  construir `/blog/tema/[slug]` para cero temas.
- **H-14, H-37 (mitad editorial), H-38, H-39** — los campos existen, el código
  los respeta, están vacíos.
- Las **asignaciones de servicio** se perdieron en el incidente del 2026-08-19 y
  no había respaldo. Sin ellas, ningún servicio muestra profesional ni precio.

### Abierto y pendiente de decisión

**S16** — el panel de tareas. Antes de empezar hay que resolver **HN-04**: ya
existe `/panel/admin/tareas` y hay que decidir si se extiende, se reemplaza, o
conviven.

### Acciones manuales pendientes

1. Los cinco usuarios necesitan «recuperar acceso»: el respaldo no tenía los
   hashes de contraseña.
2. Recargar las asignaciones de servicio.
3. Pedir reindexación en Search Console de las URLs nuevas: 8 artículos,
   1 perfil, 10 servicios y `/profesionales`.

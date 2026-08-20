# S12 · Fechas, idioma y semántica temporal

**Estado:** ejecutado el 2026-08-20.
**Hallazgos:** H-18, H-19, H-31, H-32, H-37.
**Riesgo:** bajo. Una columna aditiva y cambios de presentación.

---

## 1. H-19 era peor de lo que decía el plan

El plan advertía que `updatedAt` es una señal ruidosa porque «se toca en cualquier
`prisma.post.update`, incluidos cambios no editoriales».

Es más que eso. `src/app/api/blog/[slug]/view/route.js` incrementa el contador de
visitas con `prisma.post.update`, y `updatedAt` es `@updatedAt`. O sea:

**`updatedAt` se movía en cada visita, y el `dateModified` del JSON-LD salía de
ahí.** Le estábamos diciendo a Google que cada artículo se edita varias veces por
día.

Eso no es solo ruido: es una señal de frescura falsa, y desgasta la confianza en
la fecha. Un artículo que dice haberse actualizado hoy y no cambió una coma es
peor que uno sin fecha.

### La reparación

`contentUpdatedAt` en `Post`, **nullable**, escrito solo en las dos rutas donde
alguien edita el artículo de verdad: el editor de admin y el del profesional. No
lo tocan el contador de vistas, la aprobación de estado ni la taxonomía.

Nullable a propósito: para los quince artículos que ya existían no hay forma de
saber cuándo se editaron por última vez, y `updatedAt` está contaminado. **Nulo
significa «no sabemos»**, y el código cae a `createdAt` en vez de inventar una
fecha.

Se dejó una nota en el contador de vistas, que es donde nace el ruido, para que
nadie vuelva a confiar en `updatedAt`.

### Lo visible

«Actualizado el …» aparece solo si hubo una edición real **y posterior** a la
publicación, con más de un minuto de diferencia. Una fecha de actualización igual
a la de publicación es ruido; una anterior sería un error a la vista.

---

## 2. Los otros cuatro

**H-18.** El detalle del artículo mostraba la fecha como texto suelto. Ahora usa
`<time dateTime>` con la fecha ISO, como el listado ya hacía.

**H-31.** Convivían tres locales en un proyecto costarricense: `es-ES` en el
listado y en las series, `es-AR` en el detalle. Todo a `es-CR`.

**H-32.** `lang="es"` → `lang="es-CR"`.

**H-37.** El recorte a 160 cortaba por espacio, pero la palabra anterior al corte
podía traer puntuación pegada: once excerpts terminaban en coma o punto y coma
—«…se reconozca primero como carente,»—. Una descripción que termina en coma se
lee como un error, no como un resumen.

Ahora se limpia la puntuación colgante y se cierra con puntos suspensivos, que
dicen «esto sigue» sin fingir que la frase terminó. Se reserva el lugar del
carácter para no pasarse del límite. Y se colapsan los espacios repetidos antes
de medir, que antes contaban como caracteres.

---

## 3. Verificación

| Criterio | Resultado |
|---|---|
| `<html lang>` | `es-CR` |
| `<time dateTime>` en el detalle | presente |
| `dateModified` deja de venir de `updatedAt` | confirmado: iguala a `datePublished` cuando no hubo edición |
| «Actualizado el …» con edición real | se muestra |
| «Actualizado el …» sin edición | no se muestra |
| Meta descriptions | terminan en `…`, sin puntuación colgando |
| Suite | 679 tests (3 nuevos) |

La prueba de la fecha de actualización se hizo escribiendo `contentUpdatedAt` en
un artículo, comprobando las dos direcciones, y revirtiéndolo.

---

## 4. Lo que NO se hizo

**No se escribieron meta descriptions propias.** H-37 tiene dos mitades: que el
corte no quede feo —eso es de S12 y está hecho— y que los artículos tengan una
descripción escrita para ese fin en vez de un excerpt recortado. Lo segundo es
trabajo editorial y sigue pendiente: 13 de 15 artículos no tienen
`metaDescription`.

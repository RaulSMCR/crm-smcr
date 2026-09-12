# Ingesta de `.md` en el panel de hubs de personas

Prefiguración de lo que hace **arrastrar un archivo** (o buscarlo con el
explorador) en `/panel/admin/hubs/profesional/<id>`.

Documento companion de `ESPECIFICACION-contenido-hub.md`, que define el contrato
del archivo. Este define el contrato de la pantalla: qué se lee, qué se valida,
dónde se escribe, qué se le dice al administrador y qué **no** puede hacer la
ingesta por sí sola.

Regla que ordena todo lo demás: **una importación no publica**. Deja contenido
guardado y un botón aparte para publicarlo.

---

## 1. El destino cambió: es la base, no el repositorio

La especificación de contenido dice que la ingesta escribe
`content/hub-raul/<slug>.md` y actualiza `data/hub-raul.json`. Eso ya no
corresponde, y no es una preferencia:

- El hub vive en base desde la migración `20260911120000_professional_hubs`.
  `ProfessionalHub` + `ProfessionalHubModule` son lo que renderiza la página
  pública (`getManagedHubData` en [src/lib/hub-raul.js](src/lib/hub-raul.js)).
  Los `.md` de `content/hub-raul/` quedaron como fallback para que un despliegue
  sea navegable antes de correr la migración de datos.
- **El panel corre en Vercel con sistema de archivos de solo lectura.** Una
  pantalla de administración no puede escribir un `.md` en el repositorio. Ni
  con permisos ni con maña: no hay disco donde escribir.

De ahí tres consecuencias que reescriben los pasos 5 y 6 y el cierre del §4 de la
especificación de contenido:

| La especificación dice | Lo que efectivamente ocurre |
|---|---|
| Escribir `content/hub-raul/<slug>.md` | `upsert` de un `ProfessionalHubModule` del hub `<id>` |
| Actualizar `data/hub-raul.json` como índice | El índice son columnas de la fila: `position`, `isPublished`, `isVisible` |
| «Si hay contradicción, gana el `.md`» | Gana la base. El `.md` es la **entrada**, no la verdad; después de importar, la verdad es la fila |
| «La ingesta escribe contenido, no despliega» | No hay deploy: `revalidatePath` publica en el momento. El interruptor pasa a ser `isPublished`, y por eso la importación entra en borrador |

El `.md` sigue siendo el formato de trabajo —se redacta fuera, se versiona
fuera, se vuelve a subir cuando cambia— pero deja de ser el almacén.

---

## 2. Qué ve el administrador

Tres estados, en la misma pantalla del editor del hub, arriba de «Módulos y
contenido».

**Estado 1 — zona vacía.** «Arrastrá uno o varios archivos `.md` aquí · o hacé
clic para buscarlos · hasta 2 MB cada uno». Mismo componente y mismos límites
que la importación de artículos del blog
([src/components/blog/MarkdownFileImport.js](src/components/blog/MarkdownFileImport.js)),
que ya resuelve arrastre, lectura y errores de tipo.

**Estado 2 — informe, sin haber escrito nada.** Una fila por archivo:

```
duelo.md  →  módulo «Duelo» · /raul-olmedo-evans/duelo · ACTUALIZAR
  cuerpo        1.842 → 2.310 caracteres   (ver diferencias)
  título SEO    sin cambios
  meta          «Un espacio para elaborar…» → «Un espacio para darle lugar…»
  orden         2 → 3
  avisos        el título SEO tiene 71 caracteres (recomendado 30–60)
                «publicado: true» no publica: queda para el botón de abajo

conflictos-de-pareja.md  →  módulo NUEVO · CREAR · entra como borrador
  bloqueos      falta el bloque «riesgo» obligatorio
                «articulos_relacionados: [la-angustia]» no existe publicado
```

Y al pie: **Aplicar los 4 archivos** / **Cancelar**. Nada se escribió todavía.

**Estado 3 — aplicado.** Qué módulo quedó en qué ruta, qué estado tiene
(borrador o publicado), qué se revalidó, y la lista de enlaces internos de cada
pieza con su estado. Si algo quedó en borrador, el botón para publicarlo está
ahí, nombrando lo que va a publicar.

---

## 3. Mapa de campos: del frontmatter a la columna

Un tema (`<slug>.md`, sin `tipo`) se convierte en un `ProfessionalHubModule`.

| Campo del `.md` | Destino | Notas |
|---|---|---|
| nombre del archivo | `slug` | Vía `normalizeTopicSlug`. Si el normalizado difiere, se avisa antes de escribir |
| `titulo` | `title` | |
| `titulo_seo` | `metaTitle` (columna) | |
| `meta` | `metaDescription` (columna) | |
| `resumen` | `summary` | |
| `tarjeta` | `metadata.tarjeta` | **No hay columna y hoy no se ve**: la grilla imprime `resumen` ([page.js:151](src/app/raul-olmedo-evans/page.js#L151)) |
| `orden` | `position` | |
| `fecha`, `actualizado` | `metadata.fecha`, `metadata.actualizado` | Los únicos dos que hoy sobreviven a un guardado del editor (ver B-3) |
| `herramienta_relacionada` | `metadata.herramienta_relacionada` | Se renderiza solo si el hub tiene `tools` en `enabledFunctions` |
| `articulos_relacionados` | `metadata.articulos_relacionados` | Validado contra `Post` publicado y `Topic`, no contra el sitemap |
| `busqueda_objetivo` | `focusKeyword` (columna) | Es la columna que audita `/panel/admin/marketing/seo`; ponerlo ahí es lo que hace posible la validación de canibalización con una consulta |
| `publicado` | `isPublished`, asimétrico | `false` se aplica; `true` no publica solo (§5.3) |
| cuerpo | `body` | Máximo 50.000 caracteres (`clean` en las actions) |
| marcadores `<!-- bloque: … -->` | `metadata.bloques: ["cuando-consultar","riesgo"]` | Se conservan en el `body` y se registran aparte. Hoy no pintan caja (B-4) |
| — | `type` | Derivado: `TREATMENT` si el slug es `tratamiento-breve-15-sesiones`, `TOPIC` si no |
| — | `metadata.importacion` | `{ archivo, sha256, fecha, actor }`. Sin esto no se sabe si una fila vino de un archivo ni de cuál |

Dos columnas que existen y la especificación de contenido no cubre: `ogImage` y
`noindex`. Se aceptan como campos opcionales `imagen_social` y `no_indexar`,
con los mismos alias que ya entiende el importador de artículos
([src/lib/markdown-document.js](src/lib/markdown-document.js)), para que un
redactor no tenga que aprender dos vocabularios.

**Longitudes: manda el código, no el documento.** La especificación de contenido
pide `titulo_seo` ≤ 60 y `meta` de 120–155. El panel audita contra `SEO_LIMITS`
([src/lib/seo.js:17-20](src/lib/seo.js#L17-L20)): título 30–60, descripción
70–160. Se usa `SEO_LIMITS`, porque es lo que el resto del sitio ya mide, y
porque un rango con mínimo también atrapa el título de 22 caracteres que la otra
regla dejaba pasar. Y es **aviso, no tope**: quien escribe decide, informado.

---

## 4. `_hub.md`: qué entra y qué no

Con `tipo: hub` el archivo configura la fila del hub en lugar de crear un módulo.
Entran, directo a columnas: `nombre`→`name`, `titulo`→`title`,
`descripcion`→`description`, `whatsapp`, `modalidad`→`modality`,
`duracion_min`→`durationMin`, `serie_destacada`→`featuredSeriesSlug`,
`hero_video_url`, `hero_poster_url`, `logo_url`,
`herramientas_habilitadas`→`enabledFunctions`, y el bloque SEO.

**Nunca** entran por archivo: `slug` (mueve una URL viva), `profileSlug` (a qué
persona pertenece el hub), `status` (publicar es un acto, no un campo de texto).
Si el archivo los trae, se ignoran con aviso.

Las claves de copy del esquema —`hero`, `quince_sesiones`, `cierre`,
`barra_movil`, `pie`, `whatsapp_precargado`— **no tienen columna**. Dos caminos:

- **(a)** migración que agregue `copy Json?` a `ProfessionalHub`.
- **(b)** guardarlas en un módulo `CUSTOM` con slug `_hub`, `isVisible: false`,
  el YAML en `metadata`.

Para la primera versión, **(b)**: cero migración, reversible, y da igual cuál se
elija mientras la plantilla tenga el texto escrito adentro (B-2). Cuando el copy
salga de la plantilla, (a) es lo correcto y migrar de (b) a (a) es un script de
una pasada.

---

## 5. Validaciones

### 5.1 Bloqueos (no se escribe)

- Frontmatter sin `titulo`, o cuerpo vacío en un módulo nuevo.
- `#` en el cuerpo: el `<h1>` sale de `titulo`.
- Slug reservado o inválido (`validateTopicSlug`).
- Slug duplicado **dentro del mismo lote**: dos archivos que pelean por la misma
  ruta.
- Canibalización: `busqueda_objetivo` que ya use otro módulo publicado de
  cualquier hub, un `Topic`, un `Post` o un `Service` —consulta sobre
  `focusKeyword`—. El error nombra las dos rutas en conflicto.
- Precios, teléfonos u horarios literales en el cuerpo: `₡`, `800-`, `+506`,
  `506\d{8}`. El precio del hub sale de la tarifa vigente del profesional
  (`formatHubPrice`); un monto escrito a mano queda congelado y miente en la
  siguiente subida de tarifa.
- Enlaces absolutos al propio dominio (`https://saludmentalcostarica.com/…`).
- HTML ejecutable (`<script`, `<iframe`, `javascript:`) y bytes nulos.
- Archivo que no sea `.md`, `.markdown` o `.txt`, o de más de 2 MB. Máximo 12
  archivos por lote.

### 5.2 Avisos (se escribe, se cuenta)

- Longitudes fuera de `SEO_LIMITS`.
- Falta `cuando-consultar` o `riesgo`. La especificación de contenido los pide;
  es regla de contenido, y quien la incumple decide.
- `articulos_relacionados` con una entrada que no existe publicada. **Aviso, no
  bloqueo**: el enlace roto es real, pero el artículo puede estar por salir, y
  detener la pieza entera por un enlace es desproporcionado. Se lista para
  arreglarlo.
- `herramienta_relacionada` con un ID que el hub no tiene habilitado: el bloque
  no se va a renderizar.
- `orden` que choca con otro módulo: se reasigna y se dice a cuál.
- Slug normalizado distinto del nombre del archivo.

### 5.3 La asimetría de `publicado`

`publicado: false` **se aplica**: quitar algo de la vista es barato y reversible.
`publicado: true` **no publica**: se reporta como intención y queda esperando el
botón. Un archivo que llega por arrastre no debería poder poner una página frente
a Google sin que nadie la haya mirado en pantalla. Los módulos nuevos entran
siempre con `isPublished: false`; los existentes conservan el estado que ya
tenían.

---

## 6. El contrato de la API

Dos endpoints, mismo patrón que la importación editorial de carruseles
(`src/app/api/admin/editorial/import/{preview,confirm}`), que ya estableció la
convención `writesPerformed: false` + `confirmationRequired: true`.

**`POST /api/admin/hubs/[id]/ingesta/preview`** · `multipart/form-data`, 1..12
archivos. Solo lee. Responde:

```json
{
  "ok": true,
  "writesPerformed": false,
  "confirmationRequired": true,
  "hubId": "cmtw…",
  "lote": [{
    "archivo": "duelo.md",
    "sha256": "…",
    "clase": "tema",
    "slug": "duelo",
    "accion": "actualizar",
    "moduloId": "cm…",
    "ruta": "/raul-olmedo-evans/duelo",
    "rutaExiste": true,
    "diff": [{ "campo": "meta", "antes": "…", "despues": "…" }],
    "avisos": ["…"],
    "bloqueos": []
  }],
  "resumen": { "crear": 1, "actualizar": 3, "bloqueados": 1 }
}
```

**`POST /api/admin/hubs/[id]/ingesta/confirm`** · mismos archivos **más el
`sha256` que devolvió el preview**. El confirm recalcula el hash y rechaza si no
coincide. Es a propósito: no se guardan los archivos entre las dos llamadas —no
hay dónde, y guardarlos sería inventar un almacén temporal—, así que el navegador
los reenvía, y el hash es lo que garantiza que se aplica exactamente lo que se
mostró en el diff.

Ambos exigen `session.role === "ADMIN"`, como las actions del hub.

---

## 7. Reglas de escritura

- **Nunca borra.** Un módulo que no viene en el lote no se toca. No hay
  sincronización destructiva: un lote es un aporte, no un estado completo.
- **Nunca duplica.** Slug existente ⇒ actualizar esa fila.
- **Renombrar un archivo crea otra página.** No hay rastro entre `duelo.md` y
  `duelo-y-perdida.md`. Se avisa con las dos rutas: «esto crea un módulo nuevo;
  el anterior sigue publicado en `/raul-olmedo-evans/duelo`». Redirigir o
  archivar el viejo es una decisión aparte.
- **Un lote, una transacción** (`prisma.$transaction`). El hub primero, luego los
  temas por `orden`. Un archivo que falla no deja el lote a medias.
- **`metadata` se fusiona, no se reemplaza** (ver B-3).
- Revalidación al cierre, reusando `revalidateHub`.

---

## 8. Lo que la ingesta no puede arreglar

Cinco cosas que hay que reparar aparte. Las tres primeras hacen que hoy importar
sea guardar bien y mostrar mal.

**B-1 · Solo un hub tiene ruta pública.** Las páginas son carpetas literales:
`src/app/raul-olmedo-evans/`. `SLUGS_CON_RUTA` en
[professional-hub-queries.js:46](src/lib/professional-hub-queries.js#L46) lo dice
sin rodeos. Un hub con otro slug —el `<id>` del ejemplo, si no es el de Raúl— se
edita, se importa y se guarda bien, y su URL devuelve 404. La ingesta lo reporta
por fila (`rutaExiste: false`) y no lo arregla: hace falta un renderer genérico
`/[hub]/[modulo]`, coordinado con [src/app/[slug]](src/app/%5Bslug%5D), que hoy
sirve `Topic` y devuelve `notFound` para cualquier otra cosa.

**B-2 · La plantilla tiene texto escrito adentro.** En
[[tema]/page.js:82-86](src/app/raul-olmedo-evans/%5Btema%5D/page.js#L82-L86) el
índice lateral es una lista fija de dos entradas, y en
[la línea 105](src/app/raul-olmedo-evans/%5Btema%5D/page.js#L105) hay una caja
«Cuándo consultar» con copy genérico. Una pieza importada que traiga su propio
`## Cuándo conviene consultar` se ve **dos veces**, con dos textos distintos, y el
índice no refleja sus `##` reales. Es exactamente la regla de oro de la
especificación de contenido —«la plantilla no contiene texto»— incumplida.

**B-3 · Un guardado del editor borra lo importado.** `moduleData` reescribe
`metadata` completo con solo dos claves
([professional-hub-actions.js:108-111](src/actions/professional-hub-actions.js#L108-L111)).
Cualquier guardado desde el formulario después de una importación se lleva
`tarjeta`, `articulos_relacionados`, `herramienta_relacionada`, `bloques` e
`importacion`. Hay que fusionar con lo que ya está en la fila **antes** de
escribir la ingesta; si no, el dato dura hasta el siguiente clic en «Guardar
módulo».

**B-4 · Los marcadores de bloque son invisibles.** `MarkdownRenderer` usa
`react-markdown` sin `rehype-raw`, así que los comentarios HTML se descartan: no
hay caja teal ni borde coral. Inocuos en el cuerpo, se registran en
`metadata.bloques` para que el día que la plantilla los soporte no haya que
reimportar nada.

**B-5 · `ProfessionalHub` y `Topic` pelean por la raíz.** Los dos ocupan
`/{slug}` y `validateTopicSlug` solo cuida las rutas que son carpetas: no
consulta la otra tabla. Dos filas pueden reclamar `/duelo`. La ingesta debería
validar contra ambas, pero la colisión ya existe sin ella.

---

## 9. Pasos

Uno por sesión, cada uno con algo que mirar.

| Paso | Qué entrega | Cómo se verifica |
|---|---|---|
| **H-1** | `src/lib/hub-markdown.js`: parser puro del contrato, con sus tests. Sin Prisma, sin navegador | `npm test` con los archivos de `content/hub-raul/` como casos reales |
| **H-2** | Endpoint `preview`. No escribe nada | Subir `duelo.md` devuelve el diff contra la fila y `writesPerformed: false` |
| **H-3** | Zona de arrastre en `ProfessionalHubEditor` con el informe del §2 | Soltar cuatro archivos y ver el informe sin que cambie nada en la base |
| **H-4** | Endpoint `confirm`, transaccional, con la fusión de `metadata` de B-3 | Importar, guardar desde el editor, y comprobar que `tarjeta` sobrevive |
| **H-5** | Avisos de canibalización (consulta sobre `focusKeyword`) y de ruta inexistente (B-1) | Subir dos archivos con la misma `busqueda_objetivo`: bloquea nombrando las dos rutas |
| **H-6** | Bloques semánticos e índice desde los `##` reales: sacar el texto de la plantilla (B-2, B-4) | Un tema importado muestra sus propias cajas y una sola sección «Cuándo consultar» |

H-1 a H-4 dejan la ingesta funcionando para el hub de Raúl. H-5 y H-6 son lo que
hace que importar el hub de **otra** persona tenga sentido; antes de H-6, lo que
se importe se guarda bien y se ve con el copy de la plantilla encima.

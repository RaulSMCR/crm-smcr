# Ansiedad y angustia: estado del cluster y borrador del hub `/ansiedad`

Estado al 29-sep-2026:

- **Hub `/ansiedad` cargado en la base, en borrador**: identidad, cuatro
  secciones, cinco preguntas, los tres ensayos (aprobados) y los dos servicios.
  Falta publicarlo. Efecto ya visible: `/blog/tema/ansiedad` responde con los
  tres ensayos, y el pie de cada ensayo muestra la etiqueta «Ansiedad».
- **Publicar el hub y subir la página de consulta quedan para el panel**: el
  control de permisos de Claude Code no deja publicar contenido en producción
  desde un script. Los dos pasos están en la sección 3.
- **Serie, metas, textos alternativos y marcador de Migración**: sin aplicar.
  Respaldo de todas las filas en `docs/backups/pre-hub-ansiedad-2026-09-29.json`.
- **Código**: integrado a `main` (rama `fix/hub-ansiedad`).

## Qué se encontró

El tema tiene tres superficies, y cada una debería perseguir una búsqueda
distinta:

| URL | Para qué | Estado hoy |
|---|---|---|
| `/ansiedad` | Entender: qué distingue ansiedad de angustia | **404.** El tema existe en borrador y vacío: sin título, sin textos, sin artículos, sin servicios |
| `/raul-olmedo-evans/terapia-para-la-ansiedad` | Consultar: terapia para la ansiedad en línea | Publicada e indexable, con defectos (abajo) |
| `/blog/serie/la-angustia-y-sus-formas` | Leer: los tres ensayos | Publicada; ningún ensayo tiene tema asignado |

Defectos de la página de consulta, en producción:

1. **Dos enlaces rotos** en el párrafo que manda a los ensayos: `/angustia`
   (la serie está en `/blog/serie/la-angustia-y-sus-formas`) y `/ansiedad` (el
   hub, que no existe publicado). La ingesta avisó de los dos al importar; no
   bloquea por diseño.
2. **Título de 77 caracteres** en el buscador: el campo tiene 51 y la plantilla
   suma « | Salud Mental Costa Rica». Se corta y lleva dos separadores.
3. **H1 «Ansiedad»**: no dice lo que la página ofrece y compite con el hub,
   que es el que tiene que quedarse con «ansiedad».
4. **Meta description** sin modalidad, sin credencial y sin nada que diga dónde
   se atiende.
5. Sin firma visible ni colegiatura en la página (solo en el grafo), bloque
   «Cuándo consultar» repetido dos veces con textos distintos, y dos errores de
   JSON-LD que marca validator.schema.org. **Estos tres ya quedaron corregidos
   en código** (ver al final).
6. Un espacio antes de coma: «al día siguiente , una decisión».

Y del lado de los artículos: ninguno enlaza a la página de consulta. Quien lee
los ensayos y quiere consultar solo encuentra el botón genérico de agenda. El
camino previsto es ensayo → `/ansiedad` → consulta, y hoy el eslabón del medio
no existe.

## Lo que hay en Google para estas búsquedas

«Terapia para la ansiedad Costa Rica» y «psicólogo ansiedad San José» son de los
directorios (psicologiaymente, Psychology Today): competir ahí es caro y lento.
«Diferencia entre ansiedad y angustia» no tiene a nadie de Costa Rica: salen
repositorios universitarios y un artículo de divulgación. Es la búsqueda que el
material del sitio ya sostiene, y por eso es la del hub.

---

## 1 · El hub `/ansiedad`

Con los tres ensayos de «La angustia y sus formas» ya hay contenido detrás, que
era lo que faltaba el 15-sep. **Advertencia, como la de `/psicoanalisis`:**
ningún ensayo trata la ansiedad como categoría clínica; los tres tratan la
angustia y sus palabras. El hub es honesto como *puerta de entrada a la
diferencia entre las dos palabras*, y así está escrito. No lo sería como página
de «síntomas de la ansiedad», y no se propone ninguna sección «Qué te puede
estar pasando».

### Identidad

| Campo | Texto | Medida |
|---|---|---|
| Nombre interno | `Ansiedad` | no se toca: es el nombre de la etiqueta |
| Slug | `ansiedad` | no se toca: la página de consulta ya lo enlaza |
| Título visible (H1) | `Ansiedad y angustia` | — |
| Subtítulo | `Qué nombra cada palabra, de dónde viene la confusión y cómo se trabaja en consulta` | 82 |
| Título SEO | `Ansiedad y angustia: la diferencia` | 34 · 60 con marca |
| Meta description | `Qué distingue la ansiedad de la angustia, de dónde vienen las dos palabras y cómo se trabaja en consulta, en línea desde Costa Rica.` | 132 |

**Extracto** (266 de 500):

> En castellano, lo que aprieta tiene dos nombres. Ansiedad es el de los
> manuales, las escalas y las redes; angustia, el que conserva la clínica y el
> que viene de lo angosto. Estos ensayos siguen de dónde salen esas palabras y
> qué se pierde cuando todo se llama igual.

### Introducción editorial · «Dos nombres para lo que aprieta»

> Casi todo malestar se llama hoy ansiedad. Es la palabra de los manuales, de
> las escalas y de las redes, y sirve para empezar a hablar. Tiene una ventaja y
> un costo: se puede medir —mucha, poca, siete sobre diez— y, justamente por eso,
> dice poco de qué se trata.
>
> El castellano tiene otra palabra, más vieja, para lo mismo y no exactamente lo
> mismo: angustia. Viene del latín *angustus*, estrecho, y es la misma palabra
> que angosto; ansiedad sale de la misma raíz, la del verbo que quería decir
> apretar. Lo que esas palabras nombraron durante siglos no fue una cantidad sino
> una forma: la del paso que se cierra.
>
> Cuando se tradujo a Freud, la *Angst* alemana pasó al inglés como *anxiety* y
> al castellano, casi siempre, como *angustia*. Por eso en español conviven dos
> nombres donde otras lenguas tienen uno, y por eso la diferencia no es un
> capricho de especialistas: la ansiedad describe bien el costado medible —el
> cuerpo, la activación, lo que puntúa una escala—; la angustia, en la clínica
> psicoanalítica, nombra aquello a lo que ese costado responde.
>
> Los ensayos de esta página recorren esa historia: de dónde vienen las palabras
> del malestar, por qué el castellano lo ordenó en familias corporales y no en
> grados, y cómo lenguas sin contacto entre sí llegaron a la misma imagen del
> pecho estrecho. No hay acá una lista de síntomas para reconocerse.
>
> Si lo que buscás es consultar, en [Terapia para la ansiedad](/raul-olmedo-evans/terapia-para-la-ansiedad)
> está cómo se trabaja en un tratamiento. Si querés seguir leyendo, los ensayos
> están abajo.

Cada afirmación sale de los ensayos o de la página de consulta: la raíz
*angere* y el par angustia/angosto (entrega 1), las familias corporales
(entrega 2), el pecho estrecho en hebreo y árabe (entrega 3), y la distinción
entre el costado medible y aquello a lo que responde (la página de consulta,
«Por qué todo se llama ansiedad»).

### Secciones

| Sección | Título | Contenido |
|---|---|---|
| Artículos destacados | `Para empezar` | Entrega 1, como PRIMARY |
| Explorar este tema | `Seguir leyendo` | Entregas 2 y 3 |
| Preguntas frecuentes | (el de siempre) | Las cinco de abajo |
| Servicios | (el de siempre) | Psicoterapia psicoanalítica (destacado) y cognitivo-conductual |
| Profesionales | (el de siempre) | Salen solos: quienes tienen esos servicios aprobados, con tarifa y agenda |
| Llamado a la acción | `Podés empezar por donde te resulte posible` | Texto abajo |

Psiquiatría queda afuera mientras no tenga a nadie asignado: la tarjeta
anunciaría un servicio que no se puede agendar.

**Llamado a la acción:**

> Si ya sabés que querés consultar, en [Terapia para la ansiedad](/raul-olmedo-evans/terapia-para-la-ansiedad)
> está cómo trabaja Raúl Olmedo Evans, con qué formato y a qué precio. Los
> servicios y perfiles del equipo con agenda abierta están más arriba.

### Preguntas frecuentes

Las respuestas se muestran como texto plano: no llevan enlaces.

**¿Ansiedad y angustia son lo mismo?**
En el habla cotidiana se usan como sinónimos, y no está mal: vienen de la misma
raíz latina, la de apretar. En la clínica conviene separarlas. Ansiedad nombra
bien lo que se puede observar y medir —el cuerpo acelerado, la preocupación, lo
que puntúa una escala—; angustia, en la tradición psicoanalítica, nombra aquello
a lo que esa reacción responde.

**¿Un test en línea puede decir si tengo ansiedad?**
No. Un cuestionario bien construido sirve para ordenar una consulta y para
medir cambios en el tiempo, pero no diagnostica. Eso se establece en consulta,
con una persona profesional, y lleva más de tres minutos.

**¿La terapia para la ansiedad puede hacerse en línea?**
Sí. Las sesiones en línea permiten consultar desde cualquier lugar de Costa
Rica o desde fuera del país. Lo que cambia es el encuadre, no el trabajo.

**¿Con qué enfoques se trabaja?**
En el equipo hay psicoterapia psicoanalítica y psicoterapia cognitivo-conductual.
Parten de supuestos distintos sobre lo que le pasa a alguien y no compiten entre
sí; la serie del blog sobre escuelas de psicoterapia ayuda a orientarse entre
ellas. Cuando corresponde una evaluación psiquiátrica, se indica.

**¿Qué hago si no puedo esperar a una cita?**
Si sentís que no podés sostener lo que te está pasando, eso no espera a una
cita. En la página Ayuda inmediata del sitio están el 911 y las líneas de
atención disponibles en Costa Rica.

---

## 2 · La página de consulta corregida

Archivo listo para subir: `content/hub-raul/terapia-para-la-ansiedad.md`. Pasa
el validador de la skill del hub y el parser de la ingesta sin bloqueos. Se
sube en `/panel/admin/hubs/profesional/<id>`, en la zona del módulo «Ansiedad»
(o en la del hub: el nombre del archivo ya coincide con el slug). El panel
muestra el diff antes de escribir.

| Campo | Hoy | Propuesto |
|---|---|---|
| Título (H1, tarjeta, migas) | `Ansiedad` | `Terapia para la ansiedad` |
| Título SEO | `Terapia para la ansiedad en línea \| Cómo se trabaja` (77 en Google) | `Terapia para la ansiedad en línea` (59 en Google) |
| Meta description | `Qué se nombra cuando se dice ansiedad, qué tipos circulan en redes…` | `Terapia para la ansiedad en línea con psicólogo clínico colegiado (CPPCR): qué nombra esa palabra y cómo se trabaja en un tratamiento psicoanalítico.` (149) |
| Actualizado | 2026-09-14 | 2026-09-29 (ajustar al día en que se suba) |

Cuerpo: el mismo texto, con estos cambios.

- `/angustia` → `/blog/serie/la-angustia-y-sus-formas`.
- Se agrega un enlace a la entrega 1 con el texto «angustia y angosto son la
  misma palabra», que es la búsqueda de ese ensayo.
- «hub de ansiedad» → «ansiedad y angustia», enlazado a `/ansiedad`: el
  lector no sabe qué es un hub, y el texto del enlace le dice a Google de qué
  trata la página enlazada.
- Fuera el espacio antes de la coma.

Nada más del texto se tocó.

---

## 3 · Orden para publicar

El orden importa: si la página de consulta se sube antes de que `/ansiedad`
esté publicado, el enlace nuevo sigue dando 404.

1. ~~Desplegar el código~~ — integrado a `main` el 29-sep: la plantilla
   corregida y la redirección de `/blog/tema/ansiedad` al hub.
2. ~~Cargar el hub en borrador~~ — hecho el 29-sep con
   `node scripts/cargar-hubs-de-tema.mjs --solo ansiedad`.
3. **Revisar la vista previa** en `/panel/admin/temas/<id>/preview` y publicar
   desde el panel.
4. **Subir** `content/hub-raul/terapia-para-la-ansiedad.md` y confirmar el diff.
5. **Search Console:** inspeccionar y pedir indexación de `/ansiedad` y de
   `/raul-olmedo-evans/terapia-para-la-ansiedad` (esta última nació el 14-sep,
   después de la tanda de solicitudes del 11-sep, y no estaba en esa lista).
   Después, las tres entregas de la serie.

## 4 · Pendientes editoriales que no bloquean

- **Descripción de la serie**, que es su meta description: hoy «La angustia es
  un fenómeno central en la clínica, desde su comprensión se entienden otros
  conceptos» (99, con una coma donde va punto). Propuesta, 144:
  «Ensayos sobre la angustia: de dónde viene la palabra, qué la separa de la
  ansiedad y del miedo, y por qué importa en la clínica. Serie en curso.»
- **Meta de la entrega 1**: tiene 167 y Google la corta. Propuesta, 151:
  «Angustia viene de angustus, estrecho, y angosto es la misma palabra por otra
  vía. Qué revela el origen de las palabras del malestar, ansiedad incluida.»
- **Texto alternativo de las portadas.** Entrega 2: «Joaquin Fenix» y «miendo»
  (Joaquin Phoenix, miedo). Entrega 3: el alt es el nombre del archivo,
  `steve-mccurry-sharbat-gula-afghan-girl-pakistan`; tiene que describir lo que
  se ve.
- **Derechos de la portada de la entrega 3.** Es «Afghan Girl», de Steve
  McCurry, una de las fotografías con derechos más vigilados que existen. No es
  un tema de SEO: es un riesgo legal, y conviene reemplazarla o documentar la
  licencia.

## Lo que ya quedó hecho en código

- La página de tema del hub muestra la firma con cargo, colegiatura (enlazada
  al registro del colegio cuando hay URL) y fecha de actualización, y el precio
  y la modalidad junto al botón de agendar, como la portada del hub.
- El índice lateral sale de los `##` reales de la pieza, con anclas, y la caja
  genérica «Cuándo consultar» deja de agregarse cuando la pieza trae la suya.
  Arregla también pánico y duelo, que la tenían repetida y con el mismo `id`
  dos veces. Queda repetida en **Migración y desarraigo**, porque a su cuerpo le
  falta el marcador `<!-- bloque: cuando-consultar -->` antes de «## Cuándo
  conviene consultar» (el de riesgo sí está): se arregla volviendo a subir la
  pieza con esa línea.
- JSON-LD: `isPartOf` apunta al `#hub` que sí existe, `reviewedBy` pasó a la
  página (el `Article` no lo admite), el artículo lleva imagen y editor, y la
  persona va completa con su colegiatura.
- La ingesta verifica los enlaces a series (`/blog/serie/…`); antes daban «no
  verificable», que es como pasó `/angustia`.
- Cuando un tema publica su hub, `/blog/tema/<slug>` redirige a `/<slug>` y sale
  del sitemap: si no, serían dos URLs indexables con el mismo listado.
- El script de carga suma el hub de ansiedad, asigna artículos y servicios, y
  acepta `--solo` para no volver a escribir los otros dos hubs.

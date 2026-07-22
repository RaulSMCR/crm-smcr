---
name: instagram-slides
description: >
  Genera carruseles de Instagram como imágenes PNG 1080x1080 con la paleta de marca (teal/coral/crema).
  Úsalo SIEMPRE que el usuario mencione: carrusel, slides de Instagram, post de Instagram, infografía
  para redes, "hacer slides", "crear contenido para Instagram", "diseñar un carrusel" o cualquier
  solicitud de contenido visual para Instagram o redes sociales. También úsalo si dice "quiero publicar
  algo sobre X en Instagram" o pide crear contenido educativo/de salud visual. Produce archivos PNG
  listos para subir, con el branding de la cuenta: teal (#2B7073), coral (#FB7A62), fondo crema (#F6EFDF).
---

# Instagram Slides Generator

Genera carruseles de Instagram como imágenes PNG 1080x1080 px con la paleta de marca. El flujo es:
planificar el contenido → generar el JSON de slides → correr el script Python → entregar los PNGs.

## Paleta de marca

```
Brand Teal:    #2B7073 (principal)  |  light: #7DC1C3  |  dark: #163A3C
Accent Coral:  #FB7A62 (acento)     |  light: #FFAE9E  |  dark: #B85442
Neutros:       #383A3C (texto)      |  #7A7D7F (secundario)
Fondo app:     #F6EFDF (crema)      |  on-brand: #F5F6F2  |  on-accent: #FFF5F2
```

## Logo de marca (automático en cada slide)

El isotipo de la marca (la hoja Monstera) va en **una esquina de TODAS las slides de
cada carrusel**, como marca de agua o visible. **No se añade a la spec**: el renderer lo
compone automáticamente en cada slide. Por defecto va **abajo a la derecha, sobre el
footer**, como marca de agua sutil. Es configurable en el renderer:

- `LOGO_CORNER`: `top-left` | `top-right` | `bottom-left` | `bottom-right`.
- `LOGO_WIDTH`: ancho en px del isotipo.
- `LOGO_OPACITY`: 0-255 — marca de agua (~120-160) o visible (~230-255).
- `LOGO_MARGIN`: separación del borde (y del footer si va abajo).

El asset es `_assets/logo.png` (isotipo con fondo transparente). Si falta, el renderer
simplemente omite el logo sin romper.

## Guía editorial (OBLIGATORIA antes de escribir el copy)

El carrusel no resume un texto: produce en quien mira el deseo de informarse con nosotros.
Cada slide debe tener una tarea sobre el lector (detener, reconocer, revelar, confrontar,
prometer). Si una slide solo "presenta una parte del texto", sobra.

Reglas de voz y estilo:

1. **Primera persona plural ("nosotros")** como voz del proyecto. El lector puede ser
   interpelado en segunda persona ("te informamos", "puedes") cuando genera cercanía.
2. **Vocabulario costarricense / centroamericano neutro.** Usar "cada quien", "en el
   trabajo", "cursos en línea". Evitar rioplatensismos (vos/tenés) y españolismos.
3. **No enfrentar gente con gente.** Nunca personalizar las prácticas en figuras cercanas
   ("tu tía cree en...", "una amiga jura por..."). Hablar de preferencias que conviven,
   no de personas equivocadas. No generar clima de desconfianza: informar.
4. **Build-up emocional**: primero preferencias (neutro), después responsabilidad
   (confrontación suave). La incomodidad llega gradualmente, nunca de entrada.
5. **Calificación directa de efectos** en prácticas sin base clínica: "el tarot te hace
   creer que...", no "el tarot supone que...". Ser claros sin ser agresivos.
6. **El psicoanálisis siempre en positivo y con la potencia de su vocabulario**:
   deseo, inconsciente, palabra. Ej.: "hablando puedes encontrarte con la potencia de
   tus deseos, hasta los más inconscientes". Nunca formularlo en paralelo degradante
   con las prácticas sin evidencia.
7. **La intención editorial no se declara, se ejerce.** Nunca escribir "sin tecnicismos",
   "sin condescendencia", "sin juzgar" como copy. Mostrar el respeto, no anunciarlo.
8. **Generar confianza activa**: "nosotros lo vamos a aclarar", "te informamos con
   investigación y criterio profesional". El proyecto se posiciona como quien acompaña.
9. **CTA con valor concreto** + acción específica ("Sigue el link en bio"), nunca
   genérico ("empieza la serie", "seguinos").
10. **Preferir prosa articulada (narrative) sobre bullets (content).** Los bullets solo
    para contenido genuinamente enumerable. El esquema (map/directory) para taxonomías.

## Tipos de slide disponibles

| Tipo        | Uso ideal                                                       |
|-------------|-----------------------------------------------------------------|
| `cover`     | Primera slide: hook potente + título                            |
| `narrative` | Párrafo articulado con hook — el tipo preferido para argumentar  |
| `map`       | Esquema 2×4: taxonomía completa en una slide (hasta 8 items)     |
| `directory` | Índice vertical: hasta 4 categorías con descriptor              |
| `content`   | Lista con viñetas — solo si el contenido es enumerable           |
| `quote`     | Cita destacada; admite `accent: true` para versión coral        |
| `highlight` | Estadística o número impactante                                 |
| `cta`       | Última slide: llamado a la acción                               |

## Formato JSON de slides

```json
{
  "title": "Nombre del carrusel",
  "slides": [
    {
      "type": "cover",
      "tag": "SERIE",
      "title": "Título principal",
      "subtitle": "Promesa de valor o pregunta que detiene el scroll"
    },
    {
      "type": "narrative",
      "hook": "Título breve del párrafo",
      "body": "Párrafo articulado de 3 a 5 oraciones. Prosa de revista, no telegrama."
    },
    {
      "type": "map",
      "title": "Título del esquema",
      "items": [
        {"name": "Categoría", "desc": "representantes, ejemplos, figuras"}
      ]
    },
    {
      "type": "directory",
      "title": "Título del índice",
      "items": [
        {"name": "Categoría", "desc": "descriptor en una línea"}
      ]
    },
    {
      "type": "content",
      "title": "Título",
      "points": ["Punto uno", "Punto dos"]
    },
    {
      "type": "quote",
      "quote": "La cita destacada.",
      "author": "Fuente (opcional)",
      "accent": false
    },
    {
      "type": "highlight",
      "stat": "70%",
      "label": "descripción del dato",
      "description": "fuente o contexto (opcional)"
    },
    {
      "type": "cta",
      "cta": "Promesa de valor concreta",
      "subcta": "Acción específica (ej: Sigue el link en bio)",
      "handle": "@saludmentalcostarica"
    }
  ]
}
```

### Campos por tipo

**cover**: `tag` (pill coral opcional), `title` (obligatorio), `subtitle`

**narrative**: `hook` (título teal bold, obligatorio), `body` (párrafo). Fondo abstracto
generativo según el tema del texto.

**map**: `title` (obligatorio), `items` (lista de `{name, desc}`, hasta 8). Grid 2×4 con
líneas guía cartográficas. Ideal para mostrar un campo completo de un vistazo.

**directory**: `title` (obligatorio), `items` (lista de `{name, desc}`, hasta 4).
Índice vertical con marker coral. Para taxonomías parciales con más aire.

**content**: `title` (obligatorio), `points` (lista de strings, máx 6)

**quote**: `quote` (obligatorio), `author` (opcional), `accent` (bool opcional —
true = texto coral oscuro con marcas coral, para el enunciado más citeable del carrusel;
usar máximo una vez por carrusel)

**highlight**: `stat`, `label`, `description` (opcional)

**cta**: `cta` (obligatorio), `subcta`, `handle`

## Imágenes fotográficas

`cover` y `narrative` aceptan dos campos opcionales:

```json
{ "image": "ruta/a/foto.jpg", "image_style": "duotone" }
```

- **`image`**: path local a una foto (jpg/png, mínimo 1080px de ancho).
  - En `cover`: la foto ocupa todo el fondo, con overlay teal oscuro para legibilidad.
  - En `narrative`: la foto va en banda superior (~44%), el texto abajo sobre crema.
- **`image_style`**: `"duotone"` (default) mapea la foto a la paleta de marca
  (brand_dark → teal → crema). Usar SIEMPRE duotone salvo pedido explícito:
  garantiza que cualquier foto quede coherente con la identidad visual.
  `"photo"` conserva el color original.

Fuentes de fotos, en orden de preferencia: (1) fotos propias del proyecto,
(2) ilustraciones de la identidad Monstera exportadas a PNG, (3) stock con licencia
(Unsplash/Pexels). Nunca fotos de personas identificables sin autorización.
Usar imágenes en 1–3 slides por carrusel como máximo: el fondo abstracto generativo
sigue siendo el default; la foto es énfasis, no relleno.

## Cómo estructurar un buen carrusel

1. **Arco narrativo, no lista de temas**: detener → reconocer → revelar → (confrontar) →
   mapear → posicionarse → prometer.
2. **7–10 slides** para carruseles editoriales; 5–8 para tips simples.
3. **Una quote `accent` máximo** — es la frase para captura de pantalla.
4. **El mapa (`map`) es más atractivo que dos `directory` seguidas**: todo el campo de
   un vistazo.
5. **Las palabras nunca se dividen** (el motor hace wrap por medición real de píxeles).
   Aun así, preferir palabras de ≤14 caracteres en títulos de cover.

## Ajuste del texto a la filmina (verificar SIEMPRE)

Las filminas miden 1080×1080 px. **El texto debe caber completo, sin desbordar ni pisar
el footer/número de slide.** El motor reduce la fuente y hace wrap por medición real de
píxeles, pero **no evita el desborde vertical** si el texto es demasiado largo: hay que
controlar la extensión al redactar y revisar visualmente.

Longitudes orientativas por campo (para que entren con holgura):

- `cover.title`: ≤ ~40 caracteres (1-2 líneas). Palabras de ≤14 caracteres.
- `cover.subtitle`: ≤ ~90 caracteres.
- `narrative.hook`: ≤ ~90 caracteres (1-2 líneas).
- `narrative.body`: ≤ ~320 caracteres (3-5 oraciones cortas). Con foto, ≤ ~240.
- `map.items`: `name` ≤ ~24, `desc` ≤ ~60. Hasta 8 items.
- `directory.items`: `name` ≤ ~28, `desc` ≤ ~70. Hasta 4 items.
- `content.points`: ≤ ~90 caracteres cada uno, máx 6.
- `quote.quote`: ≤ ~160 caracteres; `author` ≤ ~40.
- `highlight.stat`: muy corto (≤ ~8); `label` ≤ ~80; `description` ≤ ~90.
- `cta.cta`: ≤ ~40; `subcta` ≤ ~80; `handle` corto.

Regla práctica: si dudas, **acorta**. Antes de entregar, revisa al menos cover, la
narrative más larga, el map y el cta; si algún texto se sale del área o toca el footer,
reduce la extensión (no dependas solo del auto-ajuste de fuente).

## Puntuación y gramática del español (obligatorio)

- **Signos de apertura Y cierre**: `¿…?` y `¡…!` — nunca solo el de cierre.
- **Tildes y ñ correctas** (á, é, í, ó, ú, ñ, ü); las mayúsculas también se tildan (Á, É…).
- **Comillas**: usar «angulares» o "dobles" de forma consistente; no mezclar estilos.
- **Puntos suspensivos** `…` (uno solo, tres puntos) y **raya** `—` para incisos.
- Nada de puntuación anglosajona (no abrir preguntas/exclamaciones sin su signo inicial).

## Workflow paso a paso

### 1. Planificá el contenido
Escribí el outline aplicando la guía editorial. Compartilo con el usuario antes de
generar para confirmar dirección, e indicá qué tarea cumple cada slide sobre el lector.

### 2. Generá el JSON
Creá `slides.json` con el contenido planificado.

### 3. Corré el script

```bash
pip install Pillow --break-system-packages -q
python <SKILL_DIR>/scripts/create_slides.py slides.json output_dir/
```

### 4. Revisá visualmente antes de entregar
Abrí al menos cover, una narrative, el map y el cta con la herramienta de visualización.
Verificá: palabras enteras, títulos que no pisan el número de slide, contraste.

### 5. Presentá los resultados
Copiá los PNGs al directorio de outputs y presentalos con links directos.

## Tips de diseño

- El **tag** de portada en pill coral: "SERIE", "SALUD", "DATO", "MITO vs REALIDAD"
- **narrative** para argumentar, **map/directory** para clasificar, **content** solo
  para lo genuinamente enumerable
- El **highlight** funciona como slide 2 para abrir con un dato
- **quote accent** reservada para la frase más potente del carrusel

# El bloque de metadatos que debe traer cada artículo

> **Para qué es este documento.** El CRM lee los `.md` que se le suben y coloca
> cada dato en su campo sin que nadie los copie a mano. Para eso el documento
> tiene que traerlos escritos. Acá está qué campos son, qué se espera de cada uno
> y el prompt listo para pedírselos a Claude en la matriz editorial.
>
> Lo que el documento no diga, el sistema **no lo inventa**: el campo queda
> vacío, la pantalla de importación lo dice y la deuda editorial lo reclama. Es a
> propósito. Un resumen generado solo, que nadie leyó, termina publicado como si
> lo hubiera escrito alguien.

---

## A. Dónde va el bloque

Al final del artículo, bajo un encabezado propio. Se acepta cualquiera de estos:

```
## Metadatos
## Metadatos para CRM
## Metadatos SEO
## Metadatos del artículo
```

El bloque y todo lo que venga después **no se publica**: el importador corta ahí.
Las notas internas —«Verificaciones pendientes antes de publicar», por ejemplo—
pueden ir debajo sin riesgo de que salgan al sitio.

También se acepta front matter YAML al inicio del archivo. Si están los dos, el
front matter manda.

---

## B. Los campos

Cada línea es `Etiqueta: valor`. Se admiten negritas, cursivas y comillas
alrededor del valor: el importador las quita.

> **Lo que no hace falta escribir.** El sistema ya lo tiene:
>
> - **Slug** — se deriva del título y queda editable en el campo. Escribilo solo
>   si querés uno más corto que el título.
> - **Fase, serie y número de entrega** — se leen de la línea de cabecera con que
>   la matriz encabeza cada artículo: `**Fase 5 · Artículo 1** · *La angustia y
>   sus formas*`. Escribirlos en el bloque los sobrescribe.
> - **Alt de portada** — solo se pide cuando hay portada.

| Campo | Etiquetas que se reconocen | Qué se espera |
|---|---|---|
| **Slug** | `Slug`, `URL` | Opcional. Minúsculas, sin tildes, con guiones. Si no está, sale del título. |
| **Resumen** | `Deck`, `Resumen`, `Excerpt`, `Bajada`, `Sumario` | 2–3 oraciones. Es lo que se ve en la biblioteca y en la tarjeta del artículo. |
| **Meta title** | `Meta title`, `Título alternativo SEO`, `Título SEO` | ≤ 60 caracteres. Es el título del resultado de búsqueda, no el del artículo. |
| **Meta description** | `Meta description`, `Descripción SEO` | ≤ 155 caracteres. Compite por el clic; no repite el meta title. |
| **Palabra clave** | `Palabra clave`, `Focus keyword` | Una sola, la que el artículo de verdad responde. |
| **Bloque extractivo** | `Bloque extractivo`, `Párrafo citable`, `Respuesta corta` | 40–60 palabras, autocontenido. Ver sección C. |
| **Portada** | `Portada`, `Imagen de portada` | URL de la imagen. |
| **Alt de portada** | `Alt de portada`, `Texto alternativo` | Qué **se ve** en la imagen. No es el nombre de la obra. |
| **Obra / autor / nota** | `Obra`, `Autor de la obra`, `Nota de la obra` | El crédito de la imagen, cuando es una obra. |
| **Fase** | `Fase` | Fase editorial. Debe existir en Taxonomía. |
| **Serie** | `Serie` | Nombre exacto de la serie. Debe existir en Taxonomía. |
| **Parte** | `Parte` | El número. `Parte: 1`. |
| **Partes** | `Partes` | Cuántas son en total. |
| **Disciplinas** | `Disciplinas`, `Disciplina` | Separadas por coma o en viñetas. Deben existir en Taxonomía. |
| **Temas** | `Temas`, `Tema`, `Etiquetas`, `Tags` | Igual. |
| **Enlaces internos** | `Enlaces internos sugeridos` | En viñetas, uno por línea. Acá la coma **no** separa. |
| **No indexar** | `Noindex`, `No indexar` | `sí` / `no`. Solo si el artículo no debe aparecer en buscadores. |

**Fase, Serie, Disciplinas y Temas se marcan solos únicamente si el nombre
coincide con el vocabulario ya cargado en Taxonomía.** Lo que no coincida se
lista aparte, sin crearse: el vocabulario es curado, y un término inventado en un
documento no debe convertirse en etiqueta de biblioteca sin que nadie lo decida.
Si hace falta uno nuevo, se agrega primero desde Taxonomía.

---

## C. El bloque extractivo, que es el que más se olvida

No es la meta description. Son dos cosas distintas y conviven:

- La **meta description** compite por el clic en Google y se corta a 155.
- El **bloque extractivo** es para que un modelo lo cite entero. Tiene que
  responder la pregunta del artículo y **entenderse fuera del artículo**: sin
  «como vimos», sin «en esta entrega», sin pronombres que apunten al párrafo
  anterior. 40 a 60 palabras.

Mal:

> Como vimos, esa raíz explica por qué las dos palabras se parecen tanto.

Bien:

> Angustia y angosto son la misma palabra latina: ambas vienen de *angustus*,
> estrecho, derivado del verbo *angere*, apretar. El castellano la recibió por
> dos caminos, el popular y el culto, y conservó las dos formas. La misma raíz
> produjo *angina*, *ansiedad* y *congoja*.

---

## D. El prompt para pedirlo

Para pegar tal cual al final de la instrucción de escritura, en la matriz
editorial:

```text
Cerrá el documento con un bloque de metadatos bajo el encabezado exacto
"## Metadatos para CRM". Una línea por campo, con el formato "Etiqueta: valor",
sin viñetas salvo donde se indique. No uses comillas ni cursivas alrededor de
los valores.

No escribas el slug, la fase, la serie ni el número de entrega: el sistema los
saca del título y de la línea de cabecera del artículo.

Escribí estos campos, todos, en este orden:

Deck: (2 o 3 oraciones, entre 25 y 50 palabras; es lo que se lee en la
  biblioteca antes de entrar al artículo)
Meta title: (máximo 60 caracteres, incluyendo la palabra clave; es el título del
  resultado de búsqueda y puede diferir del título del artículo)
Meta description: (máximo 155 caracteres; no repitas el meta title; que dé una
  razón concreta para entrar)
Palabra clave: (una sola expresión, la que este artículo de verdad responde)
Bloque extractivo: (entre 40 y 60 palabras, en un solo párrafo, autocontenido:
  tiene que entenderse leído fuera del artículo, sin "como vimos", sin "en esta
  entrega" y sin pronombres que apunten a un párrafo anterior; responde la
  pregunta central del artículo con sus datos concretos)
Alt de portada: (solo si el artículo lleva portada: qué se ve en la imagen, para
  quien no puede verla; una oración; no es el nombre de la obra ni el título)
Disciplinas: (una o dos, separadas por coma, tomadas del vocabulario del sitio)
Temas: (tres a seis, separados por coma, tomados del vocabulario del sitio)
Enlaces internos sugeridos:
- (uno por viñeta, artículos ya publicados del sitio con los que este conversa)

Reglas:
- No inventes disciplinas ni temas nuevos: usá los que ya existen en el sitio.
  Si ninguno sirve, escribí el que falta y marcalo con "(nuevo)" para que se
  decida a mano.
- No dejes ningún campo vacío ni con un guion. Si no tenés el dato —la portada,
  por ejemplo— omití la línea entera.
- Si el documento se corta en varias entregas, el bloque va una sola vez, al
  final, y describe la entrega que corresponda a ese archivo.
```

### Prompt corto, para pedir solo lo que falta

Cuando el artículo ya está escrito y la pantalla de importación dice qué falta:

```text
Este artículo ya está escrito. Agregale al final un bloque "## Metadatos para
CRM" con estos campos y nada más: <pegar acá la lista que muestra el CRM>.
Formato "Etiqueta: valor", una línea por campo, sin comillas ni cursivas.
Sacá los valores del texto del artículo; no inventes datos que el artículo no
diga.
```

---

## E. Ejemplo completo

La cabecera del artículo, que ya escribe la matriz, aporta fase, serie y entrega:

```markdown
# Angustia y angosto vienen de la misma raíz

**Fase 5 · Artículo 1** · *La angustia y sus formas*
```

Y el bloque, al final, aporta el resto:

```markdown
## Metadatos para CRM

Deck: Angustia y angosto son la misma palabra latina. Dos familias de lenguas sin
  parentesco entre sí nombraron la angustia como estrechez del pecho, y lo que se
  perdió al convertirla en una cantidad medible fue más que precisión.
Meta title: Angustia y ansiedad: por qué no significan lo mismo
Meta description: Angustia viene de angustus, estrecho. Recorrido por el origen de
  las palabras del malestar y por lo que se pierde al medirlas en una escala.
Palabra clave: origen de la palabra angustia
Bloque extractivo: Angustia y angosto son la misma palabra latina: ambas vienen de
  angustus, estrecho, derivado del verbo angere, apretar. El castellano la recibió
  por dos caminos, el popular y el culto, y conservó las dos formas. La misma raíz
  produjo angina, ansiedad y congoja.
Alt de portada: Un desfiladero estrecho entre dos paredes de roca, con una franja
  de cielo arriba.
Disciplinas: Psicología clínica
Temas: angustia, ansiedad, lenguaje, historia de la psicología
Enlaces internos sugeridos:
- Índice de la serie La angustia y sus formas.
- Qué llamamos salud, apertura de la Serie 3.
```

---

## F. Qué mira el sistema del lado de acá

- `src/lib/editorial-metadata.js` — lee el bloque y reconoce las etiquetas.
- `src/lib/markdown-document.js` — arma el artículo y calcula `faltantes`.
- `src/lib/deuda-editorial.js` — reclama lo que quedó sin cargar, ya publicado.

**Si se agrega un campo obligatorio en `deuda-editorial.js`, hay que agregarlo
también a `CAMPOS_EDITORIALES` en `markdown-document.js` y a este documento.** Si
solo se agrega allá, el archivo pasa la importación sin avisar nada y la falta
aparece semanas después, con el artículo ya indexado.

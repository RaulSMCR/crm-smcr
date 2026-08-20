# S3 · Unificación de `slugify`

**Estado:** implementado el 2026-08-20.
**Hallazgos:** H-28, H-29, H-30.
**Riesgo:** bajo. No se regeneró ningún slug: eso es S4, S5 y S6.

---

## 1. Reconocimiento: qué había realmente

Siete implementaciones, y no eran siete copias de lo mismo. **Cuatro tenían el bug y tres no**, que es peor que si todas hubieran estado mal: el mismo título producía dos slugs distintos según por dónde entrara.

| Archivo | Estado | Separador |
|---|---|---|
| `src/actions/admin-actions.js:9` | **con bug** — sin NFD | `-` |
| `src/app/api/posts/route.js:9` | **con bug** — sin NFD | `-` |
| `src/app/api/professional/posts/[id]/route.js:6` | **con bug** — sin NFD | `-` |
| `src/components/PostEditor.js:15` | **con bug** — sin NFD | `-` |
| `src/components/admin/AdminPostCreator.js:10` | correcta | `-` |
| `src/lib/carousel-spec.js:107` | correcta, con corte a 80 | `-` |
| `src/app/panel/admin/marketing/page.js:69` | correcta, con corte a 64 | `_` |

Más dos copias idénticas de `slugifySeriesName`, ambas correctas.

### El bug, exactamente

```js
.toLowerCase()
.replace(/[^a-z0-9]+/g, "-")   // sin normalizar antes
```

`é` no está en `[a-z0-9]`, así que la letra entera se reemplaza por un guión en vez de transliterarse:

```
"Qué es psicoterapia"  ->  "qu-es-psicoterapia"
"Lógicas comunes"      ->  "l-gicas-comunes"
```

Siete artículos publicados tienen hoy una URL así. **Lo que faltaba era una línea y su orden**: normalizar NFD *antes* del filtro, para que el acento se separe de la letra y solo se caiga el acento.

### H-29 explicado

`AdminPostCreator.js` —el preview— usaba la implementación **correcta**, y `api/posts/route.js` —el que graba— la **rota**. Por eso el creador mostraba `que-es-psicoterapia` y en la base quedaba `qu-es-psicoterapia`. No era un desajuste de timing: eran dos funciones distintas con el mismo nombre.

---

## 2. Lo que se hizo

### `src/lib/slug.js`, única implementación

```js
slugify(value, { separator = "-", maxLength = 80 })
slugUnico(base, estaTomado, { fallback = "articulo", ...opciones })
```

Base: la implementación correcta de `carousel-spec.js`, más tres cosas que ninguna de las siete tenía.

**`ñ` y `ç` se tratan aparte.** No son letras con diacrítico combinante en toda fuente de texto: según de dónde venga el string, `ñ` puede llegar como un único code point que NFD no descompone, y entonces caía en `[^a-z0-9]` igual que antes. `Muñoz` daba `mu-oz`. Ahora da `munoz`.

**El corte por largo respeta el separador.** Cortar a ciegas deja el slug terminado en media palabra.

**El separador es un parámetro.** El panel de marketing usa `_` a propósito —es la convención de los nombres de campaña UTM—, así que no se unificó a la fuerza: se le pasa `{ separator: "_" }` desde `slugCampania`.

### H-30 · sufijo de colisión determinista

`slugUnico` reemplaza a `Math.random().toString(36).slice(2, 7)` en `admin-actions.js` y `api/posts/route.js`. Hay un artículo publicado con la URL `la-salud-mental-no-cabe-en-una-sola-disciplina-8oyy6` por culpa de eso.

Un sufijo aleatorio no es reproducible: la misma migración corrida dos veces da URLs distintas, y el slug no se puede predecir ni verificar. `slugUnico` usa `-2`, `-3`, como ya hacía `publish-to-blog/route.js`.

**Dos arreglos que vinieron de arrastre**, porque el código viejo los tenía en la misma línea:

- El fallback `articulo-${Date.now()}` producía slugs con un timestamp de trece dígitos. Ahora es `articulo` a secas y la colisión la resuelve el sufijo.
- El chequeo era **de una sola pasada**: si `slug-abc12` también existía, el insert reventaba contra el índice único. `slugUnico` busca en bucle hasta encontrar uno libre.

### `slugifySeriesName`

Las dos copias eran equivalentes a la función unificada, así que se reemplazaron por ella. Se usaba para buscar series existentes por slug; la tabla `Series` está vacía, así que no hay riesgo de que una búsqueda deje de encontrar algo que antes encontraba.

---

## 3. Casos de prueba

Los ocho que el plan declaró obligatorios, más el resto, en `tests/unit/slug.test.js` — 21 casos:

| Entrada | Salida |
|---|---|
| `Lógicas comunes` | `logicas-comunes` |
| `¿Qué es psicoterapia?` | `que-es-psicoterapia` |
| `Introducción` | `introduccion` |
| `Raúl Olmedo` | `raul-olmedo` |
| `Muñoz Peña` | `munoz-pena` |
| `Parte 2 · Autoayuda` | `parte-2-autoayuda` |
| `Psicoterapia 🧠 hoy` | `psicoterapia-hoy` |
| `dos  espacios` | `dos-espacios` |

Y la colisión: con `titulo` y `titulo-2` ocupados, `Título` da `titulo-3`.

Hay tests que fijan explícitamente el bug viejo (`slugify("Qué")` no debe dar `qu`), para que no pueda volver sin que algo se ponga rojo.

---

## 4. Verificación

- 670 tests en verde, 21 nuevos. Build limpio.
- Ninguna implementación local de `slugify` queda en `src/`: la única está en `src/lib/slug.js`.
- Ningún `Math.random()` genera slugs.

**Una anomalía honesta:** la primera corrida de la suite después de los cambios reportó **un** test fallado, en una corrida que tardó 23 s en vez de 4 —transformación en frío—. No se pudo capturar cuál era y no volvió a aparecer en cuatro corridas posteriores. Queda anotado como inestabilidad no diagnosticada, no como algo resuelto.

---

## 5. Lo que NO se tocó

**`src/actions/auth-actions.js:301`** sigue generando el slug de profesional con `name.toLowerCase().replace(/[^\w\s-]/g, "")` — `\w` sin flag `u`, que es H-03 y produjo `ral-olmedo`. **Es de S5**, que además tiene que migrar los slugs existentes. Se deja como está por la regla de no refactorizar de paso, pero conviene saber que hasta que S5 corra, **cada profesional que se registre con un nombre acentuado sigue recibiendo un slug mutilado.**

No se regeneró ningún slug de contenido publicado. Eso es S4.

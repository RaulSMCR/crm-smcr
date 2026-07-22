# Mejoras del skill de carruseles — para portar a Claude

Cambios hechos al skill durante el trabajo en el CRM, listos para pegar en la versión
que usás directamente en Claude.

**Resumen honesto:** el **skill editorial (voz de marca) no cambió**. Entró al repo tal
como lo diste y nunca lo edité. Todas las mejoras son del **skill de carruseles**.

Son **tres bloques de texto** para `SKILL.md` y **un parche de código** para
`create_slides.py` (el bloque 1 no funciona sin el parche).

---

## 1. Logo de marca en cada slide

### 1a. Texto para `SKILL.md`

Pegar **después del bloque de código de la paleta** y **antes de**
`## Guía editorial (OBLIGATORIA antes de escribir el copy)`:

```markdown
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
```

### 1b. Parche para `create_slides.py` (imprescindible)

El texto de arriba **describe** comportamiento del renderer; sin este código el logo no
aparece. Insertar este bloque después del helper de fuentes (donde termina
`return F(min_size, bold=bold, light=light)`):

```python
# ---------------------------------------------------------------------------
# LOGO DE MARCA (isotipo en una esquina de cada slide)
# ---------------------------------------------------------------------------
_LOGO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "logo.png")
LOGO_CORNER = "bottom-right"  # top-left | top-right | bottom-left | bottom-right
LOGO_WIDTH = 104
LOGO_OPACITY = 150  # 0-255: marca de agua (~120-160) o visible (~230-255)
LOGO_MARGIN = 28
_LOGO_FOOTER_H = 72
_logo_cache = {}

def _load_logo():
    if "logo" in _logo_cache:
        return _logo_cache["logo"]
    logo = None
    try:
        p = os.path.normpath(_LOGO_PATH)
        if os.path.exists(p):
            src = Image.open(p).convert("RGBA")
            h = max(1, round(src.height * LOGO_WIDTH / src.width))
            logo = src.resize((LOGO_WIDTH, h), Image.LANCZOS)
            if LOGO_OPACITY < 255:
                r, g, b, a = logo.split()
                a = a.point(lambda v: int(v * LOGO_OPACITY / 255))
                logo = Image.merge("RGBA", (r, g, b, a))
    except Exception:
        logo = None
    _logo_cache["logo"] = logo
    return logo

def draw_logo(img, corner=LOGO_CORNER):
    """Compone el isotipo en una esquina. Devuelve RGB. No rompe si falta el asset."""
    logo = _load_logo()
    if logo is None:
        return img
    lw, lh = logo.size
    m = LOGO_MARGIN
    if corner == "top-left":
        pos = (m, m)
    elif corner == "top-right":
        pos = (SIZE[0]-lw-m, m)
    elif corner == "bottom-left":
        pos = (m, SIZE[1]-_LOGO_FOOTER_H-lh-m)
    else:
        pos = (SIZE[0]-lw-m, SIZE[1]-_LOGO_FOOTER_H-lh-m)
    base = img.convert("RGBA")
    base.alpha_composite(logo, pos)
    return base.convert("RGB")
```

Y en el bucle de `main()`, añadir la línea marcada:

```python
    for i, sd in enumerate(slides, 1):
        stype   = sd.get("type", "narrative")
        creator = CREATORS.get(stype, slide_narrative)
        img     = creator(sd, i, total)
        img     = draw_logo(img)          # <-- AÑADIR
        img.save(os.path.join(out_dir, f"slide_{i:02d}_{stype}.png"), "PNG", optimize=True)
```

### 1c. El asset

Copiar `vendor/instagram-slides/assets/logo.png` (isotipo Monstera, fondo transparente)
a la carpeta `assets/` del skill en Claude. La ruta que espera el código es
`scripts/../assets/logo.png`.

---

## 2. Ajuste del texto a la filmina

Pegar en `SKILL.md` después de la lista numerada que termina en
"preferir palabras de ≤14 caracteres en títulos de cover." y antes de
`## Workflow paso a paso`:

```markdown
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
```

---

## 3. Puntuación y gramática del español

Pegar en `SKILL.md` inmediatamente después del bloque anterior:

```markdown
## Puntuación y gramática del español (obligatorio)

- **Signos de apertura Y cierre**: `¿…?` y `¡…!` — nunca solo el de cierre.
- **Tildes y ñ correctas** (á, é, í, ó, ú, ñ, ü); las mayúsculas también se tildan (Á, É…).
- **Comillas**: usar «angulares» o "dobles" de forma consistente; no mezclar estilos.
- **Puntos suspensivos** `…` (uno solo, tres puntos) y **raya** `—` para incisos.
- Nada de puntuación anglosajona (no abrir preguntas/exclamaciones sin su signo inicial).
```

---

## Flujo de trabajo resultante

1. Redactás el carrusel en Claude con tus dos skills (consume tu plan, no créditos de API).
2. Copiás el JSON de la spec.
3. En el CRM: crear carrusel → pegar la spec → **Generar slides**.

El CRM no necesita `ANTHROPIC_API_KEY` para nada de esto. Esa variable solo alimenta el
borrador automático desde artículo, que es opcional.

#!/usr/bin/env python3
"""
Instagram Slides Generator - saludmentalcostarica.com
Paleta: Teal (#2B7073), Coral (#FB7A62), Crema (#F6EFDF)
Backgrounds: arte abstracto generativo con numpy, evocativo del contenido
"""
import json, sys, os, textwrap, hashlib, re
from pathlib import Path
import numpy as np

try:
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
except ImportError:
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "Pillow", "--break-system-packages", "-q"])
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

# -- Paleta -----------------------------------------------------------------
P = dict(
    brand     = "#2B7073", brand_mid = "#38868A", brand_lt  = "#7DC1C3",
    brand_pale= "#D2EAEB", brand_dark= "#163A3C", brand_900 = "#163A3C",
    accent    = "#FB7A62", accent_lt = "#FFAE9E", accent_dk = "#B85442",
    cream     = "#F6EFDF", cream_dark= "#EDE5D2",
    text      = "#2F3133", text_mid  = "#474A4C", text_muted= "#7A7D7F",
    on_brand  = "#F5F6F2", on_accent = "#FFF5F2",
    white     = "#FFFFFF", neutral   = "#C5C8C0",
)
SIZE  = (1080, 1080)
SITE  = "saludmentalcostarica.com"
GFONTS = "/usr/share/fonts/truetype/google-fonts"
DVAJU  = "/usr/share/fonts/truetype/dejavu"

def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def F(size, bold=False, light=False):
    paths = (
        [f"{GFONTS}/Poppins-Bold.ttf",    f"{DVAJU}/DejaVuSans-Bold.ttf"]  if bold  else
        [f"{GFONTS}/Poppins-Light.ttf",   f"{GFONTS}/Poppins-Regular.ttf"] if light else
        [f"{GFONTS}/Poppins-Regular.ttf", f"{GFONTS}/Poppins-Medium.ttf"]
    )
    for p in paths:
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def measure(draw, text, fnt):
    bb = draw.textbbox((0, 0), text, font=fnt)
    return bb[2]-bb[0], bb[3]-bb[1]

def wrap_px(draw, text, fnt, max_w_px):
    """Word-wrap por medicion real de pixeles. Nunca parte palabras."""
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=fnt) <= max_w_px or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def line_height(draw, fnt, leading):
    bb = draw.textbbox((0, 0), "Apgy", font=fnt)
    return int((bb[3]-bb[1]) * leading)

def draw_text_block(draw, text, x, y, max_w_px, fnt, color, leading=1.35, align="left"):
    lh = line_height(draw, fnt, leading)
    for line in wrap_px(draw, text, fnt, max_w_px):
        if align == "center":
            lw = draw.textlength(line, font=fnt)
            draw.text((x + (max_w_px - lw)//2, y), line, font=fnt, fill=color)
        else:
            draw.text((x, y), line, font=fnt, fill=color)
        y += lh
    return y

def text_block_height(draw, text, max_w_px, fnt, leading=1.35):
    return len(wrap_px(draw, text, fnt, max_w_px)) * line_height(draw, fnt, leading)

def fit_font(draw, text, max_w_px, start_size, bold=False, light=False, min_size=24):
    """Reduce el tamano de fuente hasta que el texto quepa en una linea."""
    size = start_size
    while size > min_size:
        fnt = F(size, bold=bold, light=light)
        if draw.textlength(text, font=fnt) <= max_w_px:
            return fnt
        size -= 2
    return F(min_size, bold=bold, light=light)

# ---------------------------------------------------------------------------
# FOTOS
# ---------------------------------------------------------------------------

def load_photo(path, size, style="duotone"):
    """
    Carga una foto, la recorta a cover-fill y opcionalmente la lleva a
    duotono de marca (brand_dark -> brand -> cream) para cohesion de paleta.
    style: "duotone" (default) | "photo" (color original)
    """
    from PIL import ImageOps
    ph = Image.open(path).convert("RGB")
    ph = ImageOps.fit(ph, size, method=Image.LANCZOS, centering=(0.5, 0.42))
    if style == "duotone":
        g  = ImageOps.autocontrast(ph.convert("L"), cutoff=1)
        ph = ImageOps.colorize(g, black=rgb(P["brand_dark"]),
                               white=rgb(P["cream"]), mid=rgb(P["brand"]))
    return ph

# ---------------------------------------------------------------------------
# ARTE ABSTRACTO GENERATIVO
# ---------------------------------------------------------------------------

# Vocabulario visual por tema
STYLE_KEYWORDS = {
    "wave_deep":    ["historia", "tiempo", "siglo", "milenio", "viraje", "occidente",
                     "antes", "despues", "transformacion", "mosaico", "pasado"],
    "radial_dark":  ["inconsciente", "alma", "profundidad", "sotano", "deseo",
                     "freud", "psique", "interior", "mente", "sueno", "cifrado"],
    "network":      ["sociedad", "social", "comunidad", "tejido", "relacion", "durkheim",
                     "vinculo", "estructura", "colectivo", "interconectado", "red"],
    "fragments":    ["dsm", "clasificar", "categoria", "sintoma", "manual", "diagnostico",
                     "criterio", "escala", "definir", "fragmento", "separar", "dividir"],
    "molecular":    ["cerebro", "serotonina", "molecula", "neurona", "farmaco", "pastilla",
                     "biologico", "sinaptico", "quimica", "laboratorio", "gen", "neuroci"],
    "desert":       ["monje", "silencio", "desierto", "celda", "asceta", "oracion", "acedia",
                     "quietud", "vacio", "soledad", "contempla", "espiritual", "meditacion"],
    "geometric":    ["poder", "estado", "control", "encierro", "manicomio", "institucion",
                     "pinel", "foucault", "biopol", "disciplina", "norma", "ley"],
    "gradient_up":  ["bienestar", "salud", "positiv", "florecer", "crecer", "evolucion",
                     "humanismo", "maslow", "autorrealizacion", "esperanza", "luz"],
    "turbulence":   ["crisis", "conflicto", "lucha", "tension", "debate", "batalla", "frente",
                     "guerra", "contraataca", "paradoja", "dilema", "desgarrador"],
}

def _normalize(text: str) -> str:
    """Minusculas sin acentos, para hacer el match de keywords robusto."""
    import unicodedata
    t = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")

def detect_style(text: str) -> str:
    text_norm = _normalize(text)
    scores = {style: 0 for style in STYLE_KEYWORDS}
    for style, keywords in STYLE_KEYWORDS.items():
        for kw in keywords:
            if kw in text_norm:
                scores[style] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "wave_deep"

def _seed(text: str) -> int:
    """Semilla determinista basada en el contenido del texto."""
    return int(hashlib.md5(text.encode()).hexdigest()[:8], 16) % 10000

def _colorize(field, colors_hex, rng):
    """Mapea campo [0,1] -> imagen RGB usando la paleta."""
    h, w = field.shape
    result = np.zeros((h, w, 3), dtype=np.uint8)
    n = len(colors_hex)
    for i, c in enumerate(colors_hex):
        lo = i / n
        hi = (i+1) / n
        mask = (field >= lo) & (field < hi)
        t = np.clip((field - lo) / (hi - lo + 1e-8), 0, 1)
        r1, g1, b1 = rgb(c)
        next_c = colors_hex[(i+1) % n]
        r2, g2, b2 = rgb(next_c)
        result[mask, 0] = (r1 + t[mask]*(r2-r1)).astype(np.uint8)
        result[mask, 1] = (g1 + t[mask]*(g2-g1)).astype(np.uint8)
        result[mask, 2] = (b1 + t[mask]*(b2-b1)).astype(np.uint8)
    return result

def make_abstract_bg(style: str, seed: int, size=(1080, 1080), alpha=60) -> Image.Image:
    """
    Genera fondo abstracto. Devuelve imagen RGBA lista para compositar.
    alpha: 0-255, que tanto se ve el fondo abstracto sobre el crema base.
    """
    W, H = size
    rng  = np.random.default_rng(seed)
    xs   = np.linspace(0, 2*np.pi, W)
    ys   = np.linspace(0, 2*np.pi, H)
    X, Y = np.meshgrid(xs, ys)
    ph   = rng.uniform(0, 2*np.pi, 6)  # fases aleatorias

    # -- generar campo ------------------------------------------------------
    if style == "wave_deep":
        f = (np.sin(2*X + ph[0]) * np.cos(1.5*Y + ph[1])
           + 0.6*np.sin(5*X + ph[2]) * np.cos(3*Y + ph[3])
           + 0.3*np.sin(9*X + ph[4]))
        colors = [P["brand_dark"], P["brand"], P["brand_mid"], P["brand_lt"]]
        blur_r = 18

    elif style == "radial_dark":
        cx, cy = np.pi + rng.uniform(-0.5, 0.5), np.pi + rng.uniform(-0.5, 0.5)
        r  = np.sqrt((X-cx)**2 + (Y-cy)**2)
        f  = np.sin(4*r + ph[0]) * np.exp(-r*0.25) + 0.4*np.sin(8*r + ph[1])
        f += 0.2 * rng.standard_normal((H, W)) * 0.05
        colors = [P["brand_dark"], P["brand_900"], P["brand"], P["brand_lt"], P["cream"]]
        blur_r = 12

    elif style == "network":
        f = np.zeros((H, W))
        n_pts = int(rng.integers(12, 22))
        pts = rng.uniform(0, 2*np.pi, (n_pts, 2))
        for px, py in pts:
            d = np.sqrt((X-px)**2 + (Y-py)**2)
            f += np.exp(-d * rng.uniform(2, 5))
        colors = [P["brand_dark"], P["brand"], P["brand_mid"], P["brand_lt"], P["brand_pale"]]
        blur_r = 8

    elif style == "fragments":
        f  = np.sin((X + Y)*3 + ph[0])
        f += 0.5*np.cos((X - Y)*2 + ph[1])
        f += 0.3*np.sin(X*6 + ph[2]) * np.sign(np.cos(Y*4 + ph[3]))
        f += 0.15 * rng.standard_normal((H, W))
        colors = [P["brand_dark"], P["brand"], P["accent_dk"], P["accent"], P["cream_dark"]]
        blur_r = 6

    elif style == "molecular":
        f = np.zeros((H, W))
        n_pts = int(rng.integers(18, 32))
        pts = rng.uniform(0, 2*np.pi, (n_pts, 2))
        rs  = rng.uniform(0.3, 0.8, n_pts)
        for (px, py), r0 in zip(pts, rs):
            d = np.sqrt((X-px)**2 + (Y-py)**2)
            f += np.exp(-((d - r0)**2) * 8)
        f += 0.4*np.sin(5*X + ph[0]) * np.sin(5*Y + ph[1])
        colors = [P["brand_dark"], P["brand"], P["brand_mid"], P["brand_lt"], P["cream"]]
        blur_r = 10

    elif style == "desert":
        f  = np.sin(X*0.8 + ph[0]) * 0.6
        f += 0.3*np.sin(Y*0.5 + ph[1])
        f += 0.1*np.sin(X*3 + ph[2]) * np.cos(Y*2 + ph[3])
        f += 0.05*rng.standard_normal((H, W))
        colors = [P["brand_pale"], P["cream_dark"], P["brand_lt"], P["cream"]]
        blur_r = 30

    elif style == "geometric":
        f = np.floor(np.sin(X*3 + ph[0]) * 2) * 0.3
        f += np.floor(np.cos(Y*2 + ph[1]) * 2) * 0.3
        f += 0.4*np.sin((X+Y)*2 + ph[2])
        colors = [P["brand_dark"], P["brand_900"], P["brand"], P["brand_mid"], P["accent_dk"]]
        blur_r = 4

    elif style == "gradient_up":
        grad = (H - np.arange(H)) / H
        f = grad[:, None] * np.ones((H, W))
        f += 0.3*np.sin(X*2 + ph[0]) * np.cos(Y*2 + ph[1])
        f += 0.1*rng.standard_normal((H, W))
        colors = [P["brand_lt"], P["brand_pale"], P["cream"], P["cream"]]
        blur_r = 25

    elif style == "turbulence":
        f  = np.sin(X*4 + ph[0]) * np.cos(Y*3 + ph[1])
        f += 0.7*np.sin(X*7 + ph[2]) * np.cos(Y*5 + ph[3])
        f += 0.4*np.cos(X*2 + Y*6 + ph[4])
        f += 0.15*rng.standard_normal((H, W))
        colors = [P["brand_dark"], P["accent_dk"], P["brand"], P["accent"], P["brand_lt"]]
        blur_r = 8

    else:  # fallback wave_deep
        f = np.sin(2*X + ph[0]) * np.cos(1.5*Y + ph[1]) + 0.5*np.sin(5*X + ph[2])
        colors = [P["brand_dark"], P["brand"], P["brand_lt"]]
        blur_r = 18

    # Normalizar
    f = (f - f.min()) / (f.max() - f.min() + 1e-8)

    # Colorizar
    art_np = _colorize(f, colors, rng)
    art_img = Image.fromarray(art_np, "RGB")

    # Blur para suavizar
    art_img = art_img.filter(ImageFilter.GaussianBlur(blur_r))

    # Convertir a RGBA con alpha controlado
    art_rgba = art_img.convert("RGBA")
    r_ch, g_ch, b_ch, _ = art_rgba.split()
    a_ch = Image.new("L", art_img.size, alpha)
    art_rgba = Image.merge("RGBA", (r_ch, g_ch, b_ch, a_ch))

    return art_rgba


def composite_bg(base_color_hex: str, style: str, seed: int) -> Image.Image:
    """Crea imagen base crema + arte abstracto encima."""
    base = Image.new("RGBA", SIZE, (*rgb(base_color_hex), 255))
    art  = make_abstract_bg(style, seed, SIZE, alpha=70)
    result = Image.alpha_composite(base, art)
    return result


# ---------------------------------------------------------------------------
# FOOTER
# ---------------------------------------------------------------------------

def footer(draw, idx, total, bg=None):
    FOOT_H = 72
    y0 = SIZE[1] - FOOT_H
    col = bg or P["brand_dark"]
    draw.rectangle([0, y0, SIZE[0], SIZE[1]], fill=rgb(col))
    fnt = F(24, light=True)
    draw.text((48, y0 + FOOT_H//2), SITE, font=fnt,
              fill=rgb(P["on_brand"]), anchor="lm")
    DOT, GAP = 9, 21
    total_dw = (total-1)*GAP + DOT
    sx = SIZE[0] - 48 - total_dw
    for i in range(total):
        x = sx + i*GAP
        c = rgb(P["accent"]) if i == idx-1 else rgb(P["neutral"])
        draw.ellipse([x, y0+FOOT_H//2-DOT//2, x+DOT, y0+FOOT_H//2+DOT//2], fill=c)


# ---------------------------------------------------------------------------
# TIPOS DE SLIDE
# ---------------------------------------------------------------------------

def slide_narrative(data, idx, total):
    """
    Diseno editorial con fondo abstracto generativo.
    Hook: bold teal | separador coral | body: oscuro
    Si data["image"] existe: foto en banda superior (duotono por defecto)
    y texto sobre crema plano en la mitad inferior.
    """
    hook = data.get("hook", "").strip()
    body = data.get("body", "").strip()
    full_text = hook + " " + body

    imgpath   = data.get("image", "")
    has_photo = bool(imgpath) and os.path.exists(imgpath)

    if has_photo:
        img  = Image.new("RGB", SIZE, rgb(P["cream"]))
        band = 470
        ph   = load_photo(imgpath, (SIZE[0], band), data.get("image_style", "duotone"))
        img.paste(ph, (0, 0))
        draw = ImageDraw.Draw(img)
        draw.rectangle([0, band, SIZE[0], band+6], fill=rgb(P["accent"]))
        draw.rectangle([0, band+6, 10, SIZE[1]-72], fill=rgb(P["brand"]))

        # Numero de slide sobre la foto
        draw.text((SIZE[0]-52, 38), f"{idx} / {total}",
                  font=F(26, light=True), fill=rgb(P["on_brand"]), anchor="rt")

        MARGIN_L = 64
        MAX_W    = SIZE[0] - MARGIN_L - 56
        hsize    = 52 if len(hook) <= 60 else 44
        hook_fnt = F(hsize, bold=True)
        body_fnt = F(31)
        hh = text_block_height(draw, hook, MAX_W, hook_fnt, 1.25)
        bh = text_block_height(draw, body, MAX_W, body_fnt, 1.42) if body else 0
        sep_h   = 34
        total_h = hh + (sep_h + bh if body else 0)
        top     = band + 40
        avail   = SIZE[1] - 72 - top - 20
        y       = top + max(0, (avail - total_h)//2)

        y_after = draw_text_block(draw, hook, MARGIN_L, y, MAX_W,
                                  hook_fnt, rgb(P["brand"]), 1.25)
        if body:
            draw.rectangle([MARGIN_L, y_after+12, MARGIN_L+56, y_after+18],
                           fill=rgb(P["accent"]))
            draw_text_block(draw, body, MARGIN_L, y_after+30, MAX_W,
                            body_fnt, rgb(P["text"]), 1.42)
        footer(draw, idx, total)
        return img

    style = detect_style(full_text)
    seed  = _seed(full_text)

    # Base con arte abstracto
    img  = composite_bg(P["cream"], style, seed).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Barra lateral izquierda teal
    draw.rectangle([0, 0, 10, SIZE[1]-72], fill=rgb(P["brand"]))

    # Numero grande como marca de agua (muy translucido)
    overlay = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    od      = ImageDraw.Draw(overlay)
    num_fnt = F(220, bold=True)
    num_str = f"{idx:02d}"
    nw, _   = measure(od, num_str, num_fnt)
    od.text((SIZE[0] - 48 - nw//2, 18), num_str,
            font=num_fnt, fill=(*rgb(P["brand_pale"]), 55))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    MARGIN_L = 64
    MAX_W    = SIZE[0] - MARGIN_L - 56

    # Numero legible arriba derecha
    n_fnt = F(26, light=True)
    draw.text((SIZE[0]-52, 38), f"{idx} / {total}",
              font=n_fnt, fill=rgb(P["brand"]), anchor="rt")

    # Tamano dinamico del hook
    hsize = 58 if len(hook) <= 60 else (50 if len(hook) <= 100 else (44 if len(hook) <= 140 else 38))
    hook_fnt = F(hsize, bold=True)
    body_fnt = F(33)
    hh = text_block_height(draw, hook, MAX_W, hook_fnt, 1.28)
    bh = text_block_height(draw, body, MAX_W, body_fnt, 1.48) if body else 0
    sep_h = 36

    total_h = hh + (sep_h + bh if body else 0)
    avail   = SIZE[1] - 72 - 80
    y = max(90, 80 + (avail - total_h)//2)

    # Caja semitransparente detras del texto para legibilidad
    pad = 20
    box_y1 = y - pad
    box_y2 = y + total_h + pad + 10
    box_overlay = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    bd = ImageDraw.Draw(box_overlay)
    bd.rectangle([MARGIN_L - pad, box_y1, SIZE[0]-40, box_y2],
                 fill=(*rgb(P["cream"]), 175))
    img = Image.alpha_composite(img.convert("RGBA"), box_overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    # Hook
    y_after = draw_text_block(draw, hook, MARGIN_L, y, MAX_W,
                               hook_fnt, rgb(P["brand"]), 1.28)

    if body:
        draw.rectangle([MARGIN_L, y_after+14, MARGIN_L+56, y_after+20],
                       fill=rgb(P["accent"]))
        draw_text_block(draw, body, MARGIN_L, y_after+32, MAX_W,
                        body_fnt, rgb(P["text"]), 1.48)

    footer(draw, idx, total)
    return img


def slide_cover(data, idx, total):
    hook_text = data.get("title", "") + " " + data.get("subtitle", "")
    style = detect_style(hook_text)
    seed  = _seed(hook_text)

    imgpath = data.get("image", "")
    if imgpath and os.path.exists(imgpath):
        # Foto de fondo (duotono por defecto) + overlay oscuro para legibilidad
        img = load_photo(imgpath, SIZE, data.get("image_style", "duotone"))
        ov_alpha = 130
    else:
        img  = Image.new("RGB", SIZE, rgb(P["brand"]))
        art  = make_abstract_bg(style, seed, SIZE, alpha=90)
        img  = Image.alpha_composite(img.convert("RGBA"), art).convert("RGB")
        ov_alpha = 90
    draw = ImageDraw.Draw(img)

    # Overlay oscuro leve para que el texto destaque
    ov = Image.new("RGBA", SIZE, (*rgb(P["brand_dark"]), ov_alpha))
    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    draw = ImageDraw.Draw(img)

    M = 72
    y = 120

    tag = data.get("tag", "")
    if tag:
        tfnt = F(26, bold=True)
        tw, th = measure(draw, tag.upper(), tfnt)
        px, py = 28, 14
        draw.rounded_rectangle([M, y, M+tw+px*2, y+th+py*2],
                                radius=(th+py*2)//2, fill=rgb(P["accent"]))
        draw.text((M+px, y+py), tag.upper(), font=tfnt, fill=rgb(P["on_accent"]))
        y += th+py*2+52

    draw.rectangle([M, y, M+52, y+6], fill=rgb(P["accent"]))
    y += 28

    tsize = 78 if len(data.get("title", "")) < 40 else 64
    y = draw_text_block(draw, data.get("title", ""), M, y,
                        SIZE[0]-M*2, F(tsize, bold=True), rgb(P["on_brand"]), 1.2) + 36

    sub = data.get("subtitle", "")
    if sub:
        draw_text_block(draw, sub, M, y, SIZE[0]-M*2,
                        F(36, light=True), rgb(P["brand_lt"]), 1.35)

    footer(draw, idx, total, bg=P["brand_900"])
    return img


def slide_content(data, idx, total):
    img  = Image.new("RGB", SIZE, rgb(P["cream"]))
    draw = ImageDraw.Draw(img)
    HH   = 168
    draw.rectangle([0, 0, SIZE[0], HH], fill=rgb(P["brand"]))
    draw.rectangle([0, HH-6, SIZE[0], HH], fill=rgb(P["accent"]))

    M = 72
    _t = data.get("title", "")
    draw.text((M, HH//2), _t, font=fit_font(draw, _t, SIZE[0]-M*2-120, 50, bold=True),
              fill=rgb(P["on_brand"]), anchor="lm")
    draw.text((SIZE[0]-M, HH//2), f"{idx:02d}/{total:02d}",
              font=F(28, light=True), fill=rgb(P["brand_pale"]), anchor="rm")

    bfnt = F(36)
    y    = HH + 50
    for pt in data.get("points", [])[:6]:
        draw.ellipse([M, y+14, M+18, y+32], fill=rgb(P["accent"]))
        y = draw_text_block(draw, pt, M+26, y, SIZE[0]-M-26-M,
                            bfnt, rgb(P["text"]), 1.32) + 18
        if y > 950: break

    footer(draw, idx, total)
    return img


def slide_directory(data, idx, total):
    """
    Esquema tipo indice: 4 items, cada uno con nombre de categoria
    (bold teal) y descripcion (regular gris). Sin vinetas.
    Marker: linea corta coral a la izquierda de cada item.
    """
    img  = Image.new("RGB", SIZE, rgb(P["cream"]))
    draw = ImageDraw.Draw(img)
    HH   = 168
    draw.rectangle([0, 0, SIZE[0], HH], fill=rgb(P["brand"]))
    draw.rectangle([0, HH-6, SIZE[0], HH], fill=rgb(P["accent"]))

    M = 72
    title = data.get("title", "")
    draw.text((M, HH//2), title,
              font=fit_font(draw, title, SIZE[0]-M*2-120, 44, bold=True),
              fill=rgb(P["on_brand"]), anchor="lm")
    draw.text((SIZE[0]-M, HH//2), f"{idx:02d}/{total:02d}",
              font=F(28, light=True), fill=rgb(P["brand_pale"]), anchor="rm")

    items = data.get("items", [])[:4]
    if not items:
        footer(draw, idx, total)
        return img

    name_fnt = F(38, bold=True)
    desc_fnt = F(28, light=True)
    max_w    = SIZE[0] - M - M - 20

    # Precalcular altura total para centrar verticalmente
    heights = []
    for it in items:
        nh = text_block_height(draw, it.get("name", ""), max_w, name_fnt, 1.25)
        dh = text_block_height(draw, it.get("desc", ""), max_w, desc_fnt, 1.4)
        heights.append((nh, dh))
    gap_between = 44
    total_h = sum(nh + 10 + dh for nh, dh in heights) + gap_between * (len(items)-1)

    avail = SIZE[1] - HH - 72 - 80
    y = HH + 40 + max(0, (avail - total_h)//2)

    for (it, (nh, dh)) in zip(items, heights):
        # Marker: linea corta coral a la izquierda
        marker_y = y + 18
        draw.rectangle([M, marker_y, M+40, marker_y+5], fill=rgb(P["accent"]))
        # Nombre de la categoria
        y_after_name = draw_text_block(draw, it.get("name", ""), M+56, y,
                                       max_w-56, name_fnt, rgb(P["brand"]), 1.25)
        # Descripcion
        draw_text_block(draw, it.get("desc", ""), M+56, y_after_name+6,
                        max_w-56, desc_fnt, rgb(P["text_mid"]), 1.4)
        y = y_after_name + 6 + dh + gap_between

    footer(draw, idx, total)
    return img


def slide_map(data, idx, total):
    """
    Mapa del campo en una sola slide: grid 2 columnas x 4 filas.
    Cada celda: marker coral + nombre (bold teal) + representantes (gris light).
    Lineas guia sutiles evocan cuadricula cartografica.
    """
    img  = Image.new("RGB", SIZE, rgb(P["cream"]))
    draw = ImageDraw.Draw(img)
    HH   = 150
    draw.rectangle([0, 0, SIZE[0], HH], fill=rgb(P["brand"]))
    draw.rectangle([0, HH-6, SIZE[0], HH], fill=rgb(P["accent"]))

    M = 56
    title = data.get("title", "")
    tfnt  = fit_font(draw, title, SIZE[0]-M*2-110, 42, bold=True)
    draw.text((M, HH//2), title, font=tfnt, fill=rgb(P["on_brand"]), anchor="lm")
    draw.text((SIZE[0]-M, HH//2), f"{idx:02d}/{total:02d}",
              font=F(26, light=True), fill=rgb(P["brand_pale"]), anchor="rm")

    items = data.get("items", [])[:8]
    rows  = (len(items)+1)//2
    top   = HH + 34
    bot   = SIZE[1] - 72 - 30
    gap_x = 44
    col_w = (SIZE[0] - M*2 - gap_x)//2
    row_h = (bot - top)//max(rows, 1)

    # Lineas guia cartograficas sutiles
    cx = SIZE[0]//2
    draw.line([cx, top+8, cx, bot-8], fill=rgb(P["brand_pale"]), width=2)
    for r in range(1, rows):
        gy = top + row_h*r
        draw.line([M, gy, SIZE[0]-M, gy], fill=rgb(P["cream_dark"]), width=2)

    name_fnt = F(30, bold=True)
    desc_fnt = F(23, light=True)

    for i, it in enumerate(items):
        col, row = i % 2, i // 2
        cx0 = M + col*(col_w + gap_x)
        cy0 = top + row*row_h
        name = it.get("name", "")
        desc = it.get("desc", "")

        nh = text_block_height(draw, name, col_w-20, name_fnt, 1.2)
        dh = text_block_height(draw, desc, col_w-20, desc_fnt, 1.3)
        block_h = 14 + nh + 6 + dh
        y = cy0 + max(10, (row_h - block_h)//2)

        draw.rectangle([cx0, y, cx0+36, y+5], fill=rgb(P["accent"]))
        y = draw_text_block(draw, name, cx0, y+14, col_w-20,
                            name_fnt, rgb(P["brand"]), 1.2)
        draw_text_block(draw, desc, cx0, y+6, col_w-20,
                        desc_fnt, rgb(P["text_mid"]), 1.3)

    footer(draw, idx, total)
    return img


def slide_quote(data, idx, total):
    quote  = data.get("quote", "")
    author = data.get("author", "")
    style  = detect_style(quote + " " + author)
    seed   = _seed(quote)

    bg = composite_bg(P["cream_dark"], style, seed).convert("RGB")
    draw = ImageDraw.Draw(bg)

    # Overlay suave
    ov = Image.new("RGBA", SIZE, (*rgb(P["cream"]), 120))
    bg = Image.alpha_composite(bg.convert("RGBA"), ov).convert("RGB")
    draw = ImageDraw.Draw(bg)

    accent = bool(data.get("accent", False))
    bar_c  = P["accent"] if accent else P["brand"]
    mark_c = P["accent_lt"] if accent else P["brand_pale"]
    txt_c  = P["accent_dk"] if accent else P["brand_dark"]

    draw.rectangle([0, 0, SIZE[0], 14], fill=rgb(bar_c))

    qfnt = F(220, bold=True)
    draw.text((52, -20), "“", font=qfnt, fill=rgb(mark_c))

    M    = 80
    qbfnt= F(48, bold=True)
    bbfnt= F(32, light=True)
    qh   = text_block_height(draw, quote, SIZE[0]-M*2, qbfnt, 1.38)
    ah   = (text_block_height(draw, author, SIZE[0]-M*2, bbfnt, 1.3)+30) if author else 0
    y    = max(280, (SIZE[1]-72-qh-24-ah)//2)

    draw = ImageDraw.Draw(bg)
    y = draw_text_block(draw, quote, M, max(280, (SIZE[1]-72-qh-24-ah)//2),
                        SIZE[0]-M*2, qbfnt, rgb(txt_c), 1.38)
    if author:
        draw.rectangle([M, y-4, M+36, y+2], fill=rgb(P["accent"]))
        draw_text_block(draw, f"— {author}", M, y+12, SIZE[0]-M*2,
                        bbfnt, rgb(P["text_mid"]), 1.3)

    footer(draw, idx, total)
    return bg


def slide_highlight(data, idx, total):
    img  = Image.new("RGB", SIZE, rgb(P["cream"]))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, SIZE[0], 12], fill=rgb(P["brand"]))

    stat  = data.get("stat", "")
    sfnt  = F(180, bold=True)
    sw, sh= measure(draw, stat, sfnt)
    draw.text(((SIZE[0]-sw)//2, 210), stat, font=sfnt, fill=rgb(P["brand"]))

    label = data.get("label", "")
    lfnt  = F(44, bold=True)
    y     = 210+sh+10
    y     = draw_text_block(draw, label, 80, y, SIZE[0]-160, lfnt, rgb(P["text"]), 1.25)

    desc  = data.get("description", "")
    if desc:
        draw_text_block(draw, desc, 80, y+10, SIZE[0]-160,
                        F(30, light=True), rgb(P["text_muted"]), 1.3)

    draw.rectangle([440, 930, 640, 938], fill=rgb(P["accent"]))
    footer(draw, idx, total)
    return img


def slide_cta(data, idx, total):
    cta_text = data.get("cta", "")
    style    = detect_style(cta_text)
    seed     = _seed(cta_text)

    img  = Image.new("RGB", SIZE, rgb(P["brand_dark"]))
    art  = make_abstract_bg(style, seed, SIZE, alpha=80)
    img  = Image.alpha_composite(img.convert("RGBA"), art).convert("RGB")
    draw = ImageDraw.Draw(img)

    draw.rectangle([340, 200, 740, 210], fill=rgb(P["accent"]))

    M     = 80
    csize = 72 if len(cta_text) < 40 else 56
    cfnt  = F(csize, bold=True)
    ch    = text_block_height(draw, cta_text, SIZE[0]-M*2, cfnt, 1.2)
    sub   = data.get("subcta", "")
    sfnt  = F(34, light=True)
    sh2   = (text_block_height(draw, sub, SIZE[0]-M*2, sfnt, 1.35)+30) if sub else 0
    y     = max(300, (SIZE[1]-72-ch-sh2)//2 - 30)

    y = draw_text_block(draw, cta_text, M, y, SIZE[0]-M*2,
                        cfnt, rgb(P["on_brand"]), 1.2, align="center")

    if sub:
        y += 20
        y = draw_text_block(draw, sub, M, y, SIZE[0]-M*2,
                            sfnt, rgb(P["brand_lt"]), 1.35, align="center")

    handle = data.get("handle", "")
    if handle:
        hfnt = F(32, bold=True)
        hw, _ = measure(draw, handle, hfnt)
        draw.text(((SIZE[0]-hw)//2, y+40), handle, font=hfnt, fill=rgb(P["accent"]))

    footer(draw, idx, total, bg=P["brand_dark"])
    return img


CREATORS = {
    "cover": slide_cover, "content":   slide_content,
    "quote": slide_quote, "highlight": slide_highlight,
    "cta":   slide_cta,   "narrative": slide_narrative,
    "directory": slide_directory, "map": slide_map,
}

def main():
    if len(sys.argv) < 3:
        print("Uso: python create_slides.py slides.json output_dir/")
        sys.exit(1)
    json_path, out_dir = sys.argv[1], sys.argv[2]
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    with open(json_path, encoding="utf-8") as f:
        carousel = json.load(f)
    slides = carousel.get("slides", [])
    total  = len(slides)
    print(f"Generando {total} slides -> {out_dir}")
    for i, sd in enumerate(slides, 1):
        stype   = sd.get("type", "narrative")
        creator = CREATORS.get(stype, slide_narrative)
        img     = creator(sd, i, total)
        img.save(os.path.join(out_dir, f"slide_{i:02d}_{stype}.png"), "PNG", optimize=True)
        print(f"  [{i:02d}] {stype} -> {detect_style(sd.get('hook','') + sd.get('body',''))}")
    print(f"\n{total} slides listas en {out_dir}")

if __name__ == "__main__":
    main()

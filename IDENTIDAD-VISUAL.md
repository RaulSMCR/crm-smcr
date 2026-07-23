# Identidad Visual — Salud Mental Costa Rica

> Guía de marca extraída de la implementación real del sitio (`saludmentalcostarica.com`).
> Fuentes: [tailwind.config.mjs](tailwind.config.mjs) y [src/app/globals.css](src/app/globals.css).

---

## 1. Esencia de marca

Marca de salud mental costarricense: cálida, cercana y confiable. La paleta combina un
**teal sereno** (calma, salud, confianza clínica) con un **coral cálido** (humanidad,
cercanía, energía) sobre un **fondo crema** que evita el frío de los blancos puros y
transmite acogida.

Regla de proporción de color aplicada en la UI:

| Rol | Proporción | Uso |
|-----|-----------|-----|
| Neutral | 60% | Fondos, texto, estructura |
| Brand (teal) | 30% | Elementos de marca, CTAs primarios, enlaces |
| Accent (coral) | 10% | Énfasis, CTAs secundarios, alertas |

---

## 2. Paleta de color

### Marca — Teal (`brand`)
Color principal. CTAs primarios, enlaces, encabezados de marca.

| Token | RGB | HEX |
|-------|-----|-----|
| brand-50  | 233 244 244 | `#E9F4F4` |
| brand-100 | 210 234 235 | `#D2EAEB` |
| brand-200 | 168 214 216 | `#A8D6D8` |
| brand-300 | 125 193 195 | `#7DC1C3` |
| brand-400 | 84 160 163  | `#54A0A3` |
| brand-500 | 56 134 138  | `#38868A` |
| **brand-600 (DEFAULT)** | 43 112 115 | `#2B7073` |
| brand-700 | 35 92 95    | `#235C5F` |
| brand-800 | 28 74 76    | `#1C4A4C` |
| brand-900 | 22 58 60    | `#163A3C` |
| brand-950 | 12 34 35    | `#0C2223` |

### Acento — Coral (`accent`)
Énfasis, CTAs secundarios, estados de alerta/urgencia.

| Token | RGB | HEX |
|-------|-----|-----|
| accent-50  | 255 245 242 | `#FFF5F2` |
| accent-100 | 255 231 224 | `#FFE7E0` |
| accent-200 | 255 203 191 | `#FFCBBF` |
| accent-300 | 255 174 158 | `#FFAE9E` |
| accent-400 | 255 145 125 | `#FF917D` |
| accent-500 | 251 122 98  | `#FB7A62` |
| **accent-600 (DEFAULT)** | 251 122 98 | `#FB7A62` |
| accent-700 | 221 104 81  | `#DD6851` |
| accent-800 | 184 84 66   | `#B85442` |
| accent-900 | 144 63 49   | `#903F31` |
| accent-950 | 89 35 27    | `#59231B` |

### Neutrales (`neutral`) — de tinte cálido
Texto, bordes, superficies. Reemplaza a gray/slate/zinc/stone en toda la UI.

| Token | RGB | HEX |
|-------|-----|-----|
| neutral-50  | 245 246 242 | `#F5F6F2` |
| neutral-100 | 236 238 232 | `#ECEEE8` |
| neutral-200 | 217 219 212 | `#D9DBD4` |
| neutral-300 | 197 200 192 | `#C5C8C0` |
| neutral-400 | 160 163 160 | `#A0A3A0` |
| neutral-500 | 122 125 127 | `#7A7D7F` |
| neutral-600 | 92 95 97    | `#5C5F61` |
| neutral-700 | 71 74 76    | `#474A4C` |
| neutral-800 | 56 58 60    | `#383A3C` |
| neutral-900 | 47 49 51    | `#2F3133` |
| neutral-950 | 26 27 28    | `#1A1B1C` |

### Fondo y colores de contexto

| Token | RGB | HEX | Uso |
|-------|-----|-----|-----|
| app-bg | 246 239 223 | `#F6EFDF` | Fondo global (crema cálido) |
| on-brand | 245 246 242 | `#F5F6F2` | Texto sobre teal |
| on-accent | 255 245 242 | `#FFF5F2` | Texto sobre coral |
| on-image | 255 251 245 | `#FFFBF5` | Texto sobre imágenes |

### Colores semánticos

| Rol | Deriva de |
|-----|-----------|
| success | brand (teal) |
| warning | accent (coral) |
| danger  | accent (coral) |

> **Nota de sistema:** en el CSS todas las utilidades de color de Tailwind
> (blue, indigo, green, red, purple, etc.) están **remapeadas** a la paleta de marca.
> Azules/verdes → `brand`; rojos/naranjas/amarillos/rosas → `accent`;
> grises → `neutral`. Esto fuerza consistencia aunque se usen clases genéricas.

---

## 3. Tipografía

Stack **sans-serif del sistema** (rendimiento y nitidez nativa, sin fuentes externas):

```
ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
Inter, "Helvetica Neue", Arial, "Noto Sans", emoji fallbacks
```

- **Cuerpo/base:** color `neutral-900` sobre fondo `app-bg`.
- **Títulos (h1–h6):** `neutral-900`, mismo stack sans.
- **Enlaces:** `brand-700`, hover `brand-600` con subrayado.
- **Código inline:** texto `brand-600`, fondo `neutral-100`, radio `0.25rem`.

---

## 4. Componentes y estilo

### Botones
| Clase | Estilo |
|-------|--------|
| `.btn-primary` | Fondo `brand-600`, texto blanco, hover `brand-700`, ring `brand-300` |
| `.btn-accent` | Fondo `accent-700`, texto blanco, hover `accent-800`, ring `accent-300` |
| `.btn-outline` | Borde `brand-600`, texto `brand-700`, hover fondo `brand-50` |
| `.btn-ghost` | Texto `brand-700`, hover fondo `brand-50` |

Base: `rounded-lg`, `px-4 py-2`, `text-sm`, `font-medium`, transición.

### Tarjetas
`.card` → `rounded-2xl` + borde + fondo blanco + sombra `card`.

### Formularios
- `.input` → `rounded-lg`, borde `neutral-300`, focus borde/ring `brand-500`.
- `.label` → `text-sm font-medium text-neutral-700`.
- `.help` → `text-xs text-neutral-500`.

### Radios y sombras
- Radio destacado: `2xl` = `1rem`.
- Sombra de tarjeta: `0 8px 24px rgba(0,0,0,0.08)`.
- Contenedor centrado, padding `1rem`, ancho máx. `1200px`.

---

## 5. Superficies y efectos

- **`.bg-surface`** — degradado claro para páginas/secciones:
  `linear-gradient(145deg, neutral-50 → app-bg → neutral-100)`.
- **`.bg-surface-dark`** — degradado oscuro para héroes/paneles:
  `linear-gradient(145deg, neutral-950 → neutral-900)`.
- **`.contrast-on-image`** — texto claro con sombra para legibilidad sobre fotos.
- **`.image-overlay-strong`** — overlay oscuro degradado (teal muy oscuro) sobre imágenes.
- **Animaciones:** `carousel-fade-in` (0.4s) para slides; zoom suave ×1.06 en imágenes de tarjeta al hover.

---

## 6. Reglas de accesibilidad y contraste

- Nunca texto blanco sobre neutros claros o fondos crema → se fuerza a `brand-950`.
- Fondos brand/accent claros (50–400) siempre usan texto oscuro `neutral-950`.
- Botones sobre superficies claras se normalizan a `brand-600` con texto blanco.
- **`.emergency-alert`** — bloque de urgencia: fondo `accent-900`, texto blanco,
  borde `accent-950` (para líneas de crisis / atención inmediata).

---

## 7. Resumen para uso rápido

| Elemento | Color |
|----------|-------|
| Fondo de página | `#F6EFDF` (crema) |
| Color primario | `#2B7073` (teal) |
| Color de acento | `#FB7A62` (coral) |
| Texto principal | `#2F3133` |
| Enlaces | `#235C5F` |
| Alerta/urgencia | `#903F31` sobre coral |

# Tipología de slides

## Fuente

Los tipos actualmente soportados por `src/lib/carousel-spec.js` y el renderer son:

- `cover`;
- `narrative`;
- `map`;
- `directory`;
- `content`;
- `quote`;
- `highlight`;
- `cta`.

## Reglas conocidas por tipo

| Tipo | Campos verificados | Uso documentado por el código |
|---|---|---|
| `cover` | `tag`, `title`, `subtitle`, `image`, `image_style` | Apertura |
| `narrative` | `hook`, `body`, `image`, `image_style` | Desarrollo narrativo |
| `map` | `title`, `items[]` con `name` y `desc` | Mapa de elementos |
| `directory` | `title`, `items[]` con `name` y `desc` | Directorio |
| `content` | `title`, `points[]` | Puntos de contenido |
| `quote` | `quote`, `author`, `accent` | Frase destacada |
| `highlight` | `stat`, `label`, `description` | Destacado |
| `cta` | `cta`, `subcta`, `handle` | Cierre actual |

## Límite de procedencia

La existencia de un tipo en el renderer no obliga a utilizarlo en todos los carruseles. La selección debe respetar el manifiesto editorial y las decisiones visuales. No se añaden tipos ni límites nuevos sin una fuente aprobada.

## Vacíos pendientes

- No hay una taxonomía editorial completa separada de la taxonomía técnica.
- No hay un corpus confirmado de ejemplos aprobados por tipo.
- El cierre `cta` existente no convierte automáticamente una pieza en contenido vendedor: debe revisarse contra el manifiesto.

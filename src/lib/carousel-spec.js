import { z } from "zod";

// Tipos de slide soportados por el renderer (api/slides/_lib/renderer.py).
export const SLIDE_TYPES = [
  "cover",
  "narrative",
  "map",
  "directory",
  "content",
  "quote",
  "highlight",
  "cta",
];

// Regex de slug: debe coincidir con el que valida la función Python (generate.py).
export const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;

const imageFields = {
  image: z.string().trim().min(1).optional(),
  image_style: z.enum(["duotone", "photo"]).optional(),
};

const itemSchema = z.object({
  name: z.string().min(1, "name es obligatorio"),
  desc: z.string().optional().default(""),
});

const coverSlide = z.object({
  type: z.literal("cover"),
  tag: z.string().optional(),
  title: z.string().min(1, "cover requiere title"),
  subtitle: z.string().optional(),
  ...imageFields,
}).passthrough();

const narrativeSlide = z.object({
  type: z.literal("narrative"),
  hook: z.string().min(1, "narrative requiere hook"),
  body: z.string().optional(),
  ...imageFields,
}).passthrough();

const mapSlide = z.object({
  type: z.literal("map"),
  title: z.string().min(1, "map requiere title"),
  items: z.array(itemSchema).min(1, "map requiere al menos 1 item").max(8, "map admite hasta 8 items"),
}).passthrough();

const directorySlide = z.object({
  type: z.literal("directory"),
  title: z.string().min(1, "directory requiere title"),
  items: z.array(itemSchema).min(1, "directory requiere al menos 1 item").max(4, "directory admite hasta 4 items"),
}).passthrough();

const contentSlide = z.object({
  type: z.literal("content"),
  title: z.string().min(1, "content requiere title"),
  points: z.array(z.string().min(1)).min(1, "content requiere al menos 1 punto").max(6, "content admite hasta 6 puntos"),
}).passthrough();

const quoteSlide = z.object({
  type: z.literal("quote"),
  quote: z.string().min(1, "quote requiere quote"),
  author: z.string().optional(),
  accent: z.boolean().optional(),
}).passthrough();

const highlightSlide = z.object({
  type: z.literal("highlight"),
  stat: z.string().min(1, "highlight requiere stat"),
  label: z.string().optional(),
  description: z.string().optional(),
}).passthrough();

const ctaSlide = z.object({
  type: z.literal("cta"),
  cta: z.string().min(1, "cta requiere cta"),
  subcta: z.string().optional(),
  handle: z.string().optional(),
}).passthrough();

export const slideSchema = z.discriminatedUnion("type", [
  coverSlide,
  narrativeSlide,
  mapSlide,
  directorySlide,
  contentSlide,
  quoteSlide,
  highlightSlide,
  ctaSlide,
]);

export const carouselSpecSchema = z.object({
  title: z.string().optional(),
  slides: z.array(slideSchema).min(1, "El carrusel necesita al menos una slide"),
});

export const createCarouselSchema = z.object({
  title: z.string().min(1, "El título es obligatorio"),
  slug: z.string().regex(SLUG_RE, "slug inválido: minúsculas, dígitos, '-' o '_'").optional(),
  spec: carouselSpecSchema,
  // Artículo fuente (opcional): para poder "Enviar al blog" luego.
  sourceText: z.string().optional(),
  sourcePostId: z.string().optional(),
});

export function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Convierte issues de zod en mensajes legibles con la ruta al campo. */
export function formatZodIssues(issues) {
  return issues.map((i) => {
    const path = i.path.join(".");
    return path ? `${path}: ${i.message}` : i.message;
  });
}

/**
 * Validación en vivo para la UI: parsea el JSON y lo valida contra el schema.
 * Devuelve { ok, errors: string[], data }.
 */
export function validateSpecJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`JSON inválido: ${e.message}`], data: null };
  }
  const result = carouselSpecSchema.safeParse(parsed);
  if (result.success) return { ok: true, errors: [], data: result.data };
  return { ok: false, errors: formatZodIssues(result.error.issues), data: null };
}

// Spec de ejemplo para precargar el editor al crear un carrusel nuevo.
export const EXAMPLE_SPEC = {
  title: "Nuevo carrusel",
  slides: [
    {
      type: "cover",
      tag: "SERIE",
      title: "Título que detiene el scroll",
      subtitle: "Una promesa de valor concreta contada por nosotros",
    },
    {
      type: "narrative",
      hook: "El hook que abre el argumento",
      body: "Párrafo articulado de 3 a 5 oraciones. Prosa de revista, no telegrama. Aquí desarrollamos la idea con voz nosotros y cercanía.",
    },
    {
      type: "cta",
      cta: "Sigue el link en bio",
      subcta: "Acción específica con valor",
      handle: "@saludmentalcostarica",
    },
  ],
};

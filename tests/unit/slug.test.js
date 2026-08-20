import { describe, it, expect } from "vitest";
import { slugify, slugUnico } from "@/lib/slug";

describe("slugify", () => {
  // Los casos que el plan declaró obligatorios. Los cinco primeros son títulos
  // reales de artículos publicados cuya URL quedó mutilada.
  const casos = [
    ["Lógicas comunes", "logicas-comunes"],
    ["¿Qué es psicoterapia?", "que-es-psicoterapia"],
    ["Introducción", "introduccion"],
    ["Raúl Olmedo", "raul-olmedo"],
    ["Muñoz Peña", "munoz-pena"],
    ["Parte 2 · Autoayuda", "parte-2-autoayuda"],
    ["Del alma atribulada: un itinerario genealógico", "del-alma-atribulada-un-itinerario-genealogico"],
    ["Autoayuda pop y psicólogo influencer", "autoayuda-pop-y-psicologo-influencer"],
  ];

  for (const [entrada, esperado] of casos) {
    it(`"${entrada}" -> "${esperado}"`, () => {
      expect(slugify(entrada)).toBe(esperado);
    });
  }

  it("translitera los acentos en vez de comerse la letra", () => {
    // Es el bug que mutiló siete URLs publicadas: sin normalizar NFD primero,
    // la letra acentuada entera caía en [^a-z0-9] y se volvía un guión.
    expect(slugify("Qué")).toBe("que");
    expect(slugify("Qué")).not.toBe("qu");
    expect(slugify("Lógicas")).toBe("logicas");
    expect(slugify("Lógicas")).not.toBe("l-gicas");
  });

  it("maneja ñ y ç, que no son diacríticos combinantes", () => {
    expect(slugify("Muñoz")).toBe("munoz");
    expect(slugify("PEÑA")).toBe("pena");
    expect(slugify("Français")).toBe("francais");
  });

  it("colapsa espacios repetidos y signos en un solo separador", () => {
    expect(slugify("dos  espacios")).toBe("dos-espacios");
    expect(slugify("uno --- dos")).toBe("uno-dos");
    expect(slugify("¡Hola!, ¿qué tal?")).toBe("hola-que-tal");
  });

  it("recorta guiones de los extremos", () => {
    expect(slugify("  ·título·  ")).toBe("titulo");
    expect(slugify("---a---")).toBe("a");
  });

  it("descarta emoji sin dejar rastro", () => {
    expect(slugify("Psicoterapia 🧠 hoy")).toBe("psicoterapia-hoy");
    expect(slugify("🎉")).toBe("");
  });

  it("tolera entradas vacías, nulas y no textuales", () => {
    expect(slugify("")).toBe("");
    expect(slugify(null)).toBe("");
    expect(slugify(undefined)).toBe("");
    expect(slugify(123)).toBe("123");
  });

  it("recorta por separador, sin partir una palabra al medio", () => {
    const r = slugify("palabras que van a superar el limite impuesto aca", { maxLength: 20 });
    expect(r.length).toBeLessThanOrEqual(20);
    expect(r.endsWith("-")).toBe(false);
    expect(r).toBe("palabras-que-van-a");
  });

  it("acepta separador propio, para los nombres de campaña UTM", () => {
    // El panel de marketing usa `_` a propósito: es la convención de UTM y no
    // se unifica a la fuerza.
    expect(slugify("Autoayuda pop · Parte II", { separator: "_" })).toBe("autoayuda_pop_parte_ii");
    expect(slugify("--x--", { separator: "_" })).toBe("x");
  });

  it("nombres de persona: el registro producía slugs sin la letra acentuada", () => {
    // src/actions/auth-actions.js armaba el slug con `[^\w\s-]` y `\w` sin flag
    // `u`, que es [A-Za-z0-9_]: la letra acentuada no coincidía y se BORRABA,
    // en vez de convertirse en guión como pasaba con los artículos. Por eso el
    // perfil de Raúl quedó en `ral-olmedo`.
    expect(slugify("Raúl Olmedo")).toBe("raul-olmedo");
    expect(slugify("María Muñoz Peña")).toBe("maria-munoz-pena");
    expect(slugify("José Ángel Gutiérrez")).toBe("jose-angel-gutierrez");
    expect(slugify("Ñuño Íñiguez")).toBe("nuno-iniguez");
    expect(slugify("François Dupont")).toBe("francois-dupont");
  });

  it("es determinista: la misma entrada da siempre lo mismo", () => {
    const t = "Qué es psicoterapia y cómo orientarse entre escuelas. Parte 3.";
    expect(slugify(t)).toBe(slugify(t));
  });
});

describe("slugUnico", () => {
  it("devuelve la raíz si está libre", async () => {
    expect(await slugUnico("Qué es psicoterapia", async () => false)).toBe("que-es-psicoterapia");
  });

  it("usa sufijo incremental y no aleatorio ante una colisión", async () => {
    // Antes era Math.random().toString(36), que produjo el slug publicado
    // `la-salud-mental-no-cabe-en-una-sola-disciplina-8oyy6`. Un sufijo
    // aleatorio no es reproducible ni verificable.
    const tomados = new Set(["titulo", "titulo-2"]);
    expect(await slugUnico("Título", async (s) => tomados.has(s))).toBe("titulo-3");
  });

  it("recurre al fallback si el texto no deja nada usable", async () => {
    expect(await slugUnico("🎉", async () => false)).toBe("articulo");
    expect(await slugUnico("", async () => false, { fallback: "servicio" })).toBe("servicio");
  });

  it("dos corridas con el mismo estado dan el mismo resultado", async () => {
    const tomados = new Set(["x"]);
    const a = await slugUnico("X", async (s) => tomados.has(s));
    const b = await slugUnico("X", async (s) => tomados.has(s));
    expect(a).toBe(b);
    expect(a).toBe("x-2");
  });
});

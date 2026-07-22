import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCarouselActor } from "@/lib/carousel-access";
import { carouselSpecSchema, formatZodIssues } from "@/lib/carousel-spec";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// La llamada a Anthropic con thinking puede tardar; damos margen (requiere plan Pro).
export const maxDuration = 60;

// Modelo por defecto: Opus 4.8 (guia de modelos vigente). Override por env para
// bajar a un modelo mas economico (p.ej. claude-sonnet-4-6) sin tocar codigo.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

function readVendor(...segments) {
  try {
    return fs.readFileSync(path.join(process.cwd(), "vendor", ...segments), "utf8");
  } catch {
    return "";
  }
}

let cachedGuides = null;
function loadGuides() {
  if (cachedGuides !== null) return cachedGuides;
  cachedGuides = {
    // Voz de marca SMCR (principios profundos, no conflictivos con el formato).
    voice: readVendor("smcr-editorial", "voz-marca.md"),
    // Guía de formato de carruseles (autoridad sobre estructura, 2ª persona y CTA).
    carousel: readVendor("instagram-slides", "SKILL.md"),
  };
  return cachedGuides;
}

function extractText(message) {
  return (message.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function stripFences(text) {
  // El modelo puede envolver el JSON en ```json ... ``` a pesar de la instruccion.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : text).trim();
}

function tryParseSpec(raw) {
  let parsed;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch (e) {
    return { ok: false, errors: [`JSON invalido: ${e.message}`] };
  }
  const result = carouselSpecSchema.safeParse(parsed);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: formatZodIssues(result.error.issues) };
}

export async function POST(req) {
  const { res } = await getCarouselActor();
  if (res) return res;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { message: "ANTHROPIC_API_KEY no está configurada en el entorno." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const articleText = String(body.articleText || "").trim();
  const notes = String(body.notes || "").trim();
  if (articleText.length < 80) {
    return NextResponse.json(
      { message: "Pega el texto del artículo (mínimo ~80 caracteres) para generar la propuesta." },
      { status: 422 }
    );
  }

  const { voice, carousel } = loadGuides();
  const system =
    (voice ? `# VOZ DE MARCA (aplica siempre)\n\n${voice}\n\n---\n\n` : "") +
    (carousel ? `# GUÍA DE CARRUSELES (autoridad sobre formato)\n\n${carousel}\n\n---\n\n` : "") +
    "Eres el redactor de carruseles del proyecto. Aplica la VOZ DE MARCA en el contenido y la " +
    "GUÍA DE CARRUSELES para el formato: cuando haya tensión (segunda persona, CTA), manda la guía " +
    "de carruseles. Respeta: voz nosotros, distancia sin descalificación, reconocimiento afirmativo, " +
    "sin bullets innecesarios, una sola quote accent, arco narrativo, CTA con valor concreto (nunca de urgencia). " +
    "IMPORTANTE: cada texto debe CABER en la filmina 1080x1080 — respeta las longitudes orientativas de la guía " +
    "(sección 'Ajuste del texto a la filmina') y, ante la duda, acorta. Usa puntuación correcta del español: " +
    "signos de apertura y cierre (¿…? ¡…!), tildes y ñ. " +
    "Devuelve ÚNICAMENTE el JSON de la spec: un objeto con \"title\" (string) y \"slides\" (array). " +
    "Nada de markdown, nada de explicación, nada de bloques de código. Solo el objeto JSON.";

  const userPrompt =
    `Artículo:\n${articleText}\n\n` +
    (notes ? `Notas del editor: ${notes}\n\n` : "") +
    "Genera la spec de un carrusel editorial de 7 a 10 slides que respete la guía.";

  const client = new Anthropic();

  async function ask(extra) {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: userPrompt + (extra || "") }],
    });
    return extractText(message);
  }

  let raw;
  try {
    raw = await ask("");
  } catch (err) {
    const status = err?.status || 502;
    return NextResponse.json(
      { message: "Fallo al llamar a la API de Anthropic", detail: String(err?.message || err) },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }

  let parsed = tryParseSpec(raw);

  // Un reintento pidiendo corrección con el detalle del error.
  if (!parsed.ok) {
    try {
      raw = await ask(
        `\n\nUn intento anterior produjo un JSON inválido con estos errores: ${parsed.errors.join("; ")}. ` +
          "Devuelve SOLO el JSON corregido y válido, sin ningún texto adicional."
      );
      parsed = tryParseSpec(raw);
    } catch (err) {
      return NextResponse.json(
        { message: "Fallo en el reintento de generación", detail: String(err?.message || err) },
        { status: 502 }
      );
    }
  }

  if (!parsed.ok) {
    return NextResponse.json(
      { message: "El modelo no produjo una spec válida", errors: parsed.errors, raw },
      { status: 422 }
    );
  }

  return NextResponse.json({ spec: parsed.data, model: MODEL });
}

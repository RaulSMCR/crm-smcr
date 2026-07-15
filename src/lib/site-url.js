/**
 * URL base del sitio, en un solo lugar.
 *
 * Antes convivían cuatro variables para el mismo concepto (`NEXT_PUBLIC_URL`,
 * `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`) más el
 * dominio escrito a mano en metadatos y JSON-LD. Hoy todas apuntan al mismo
 * lugar, así que nada falla; el problema aparece con un staging o un cambio de
 * dominio, cuando unas se actualizan y otras no.
 *
 * Se aceptan las cuatro por compatibilidad con los despliegues existentes: no
 * hace falta tocar el entorno. Para código nuevo, usar `SITE_URL`.
 */
const FALLBACK = "https://saludmentalcostarica.com";

function resolveSiteUrl() {
  // Se normaliza cada candidata ANTES de elegir: una variable puesta en blanco
  // es truthy y, encadenada con `||`, taparía a las siguientes en silencio.
  const value = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ]
    .map((candidate) => String(candidate || "").trim())
    .find(Boolean);

  if (value) return value.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return FALLBACK;
}

export const SITE_URL = resolveSiteUrl();

/** Une la base con una ruta, sin barras dobles. */
export function siteUrl(path = "") {
  if (!path) return SITE_URL;
  return `${SITE_URL}/${String(path).replace(/^\/+/, "")}`;
}

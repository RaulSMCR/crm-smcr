import { google } from "googleapis";
import { siteUrl } from "@/lib/site-url";

/**
 * Ruta del callback OAuth, en un solo lugar.
 *
 * Debe coincidir *exactamente* con un "Authorized redirect URI" registrado en
 * Google Cloud Console; si no, Google rechaza la autorizacion.
 */
export const GOOGLE_CALLBACK_PATH = "panel/profesional/integraciones/callback";

/**
 * Crea un cliente OAuth2 de Google usando variables de entorno.
 *
 * Requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.
 *
 * El redirect_uri se deriva de `siteUrl()`, igual que en `@/lib/google-oauth`:
 * antes esta copia dependia de GOOGLE_REDIRECT_URI, que apuntaba a otro dominio
 * (el de Vercel) y hacia que el flujo de autorizacion y el de sincronizacion
 * usaran URIs distintas. GOOGLE_REDIRECT_URI se sigue respetando si esta
 * definida, por compatibilidad con despliegues existentes.
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Google OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
    );
  }

  const redirectUri =
    String(process.env.GOOGLE_REDIRECT_URI || "").trim() ||
    siteUrl(GOOGLE_CALLBACK_PATH);

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
}

/**
 * Devuelve un cliente de Google Calendar autenticado.
 *
 * @param {string} refreshToken - Google OAuth refresh token
 */
export function getCalendarClient(refreshToken) {
  if (!refreshToken) {
    throw new Error("Missing refreshToken for Google auth");
  }

  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return google.calendar({
    version: "v3",
    auth: oAuth2Client,
  });
}

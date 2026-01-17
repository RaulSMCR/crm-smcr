import { google } from "googleapis";

/**
 * Crea un cliente OAuth2 de Google usando variables de entorno.
 *
 * Requiere:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI
 */
export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI"
    );
  }

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

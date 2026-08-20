import { google } from 'googleapis';
import { siteUrl } from "@/lib/site-url";

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Antes esto era `process.env.NEXT_PUBLIC_BASE_URL + "/..."`: si la variable
    // faltaba, el redirect_uri quedaba en "undefined/panel/..." y Google
    // rechazaba la autorización con un error que no dice qué pasó.
    siteUrl("panel/profesional/integraciones/callback")
  );
}
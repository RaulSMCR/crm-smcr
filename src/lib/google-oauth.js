import { google } from 'googleapis';
import { siteUrl } from "@/lib/site-url";
import { GOOGLE_CALLBACK_PATH } from "@/lib/google";

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    // Antes esto era `process.env.NEXT_PUBLIC_BASE_URL + "/..."`: si la variable
    // faltaba, el redirect_uri quedaba en "undefined/panel/..." y Google
    // rechazaba la autorización con un error que no dice qué pasó.
    //
    // La ruta vive en `@/lib/google` para que el cliente que pide autorización y
    // el que refresca el token no puedan divergir.
    siteUrl(GOOGLE_CALLBACK_PATH)
  );
}

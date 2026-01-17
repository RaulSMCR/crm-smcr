// src/app/api/auth/google/connect/route.js
import { NextResponse } from "next/server";
import { getOAuth2Client } from "@/lib/google";

// Evita que Next intente tratar esta ruta como estática
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Los "scopes" son los permisos que solicitamos
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly", // Ver eventos del calendario
  "https://www.googleapis.com/auth/calendar.events",   // Crear y editar eventos
];

export async function GET() {
  // Creamos el cliente OAuth2 usando env vars
  const oAuth2Client = getOAuth2Client();

  // Generamos la URL a la que el usuario será redirigido
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline", // Necesario para obtener refresh_token
    prompt: "consent",      // Fuerza que Google entregue refresh_token (útil en pruebas)
    scope: SCOPES,
  });

  // Redirigimos al usuario a la página de consentimiento de Google
  return NextResponse.redirect(authUrl);
}

'use server'

import { getOAuth2Client } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma"; // Tu cliente prisma corregido
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// 1. Generar URL de autorización (El botón "Conectar")
export async function generarUrlConexionGoogle() {
  const oauth2Client = getOAuth2Client();

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // CRUCIAL: Esto nos da el Refresh Token
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    prompt: 'consent', // Fuerza a Google a preguntar siempre (garantiza refresh_token)
    include_granted_scopes: true
  });

  return url; // Retornamos la URL para que el cliente redirija
}

// 2. Intercambiar Código por Token (El Callback)
export async function guardarCredencialesGoogle(code, professionalId) {
  if (!code || !professionalId) return { error: "Faltan datos" };

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    // Si Google no nos dio refresh_token, es porque el usuario ya autorizó antes
    // y no forzamos el prompt='consent'. Pero nuestra URL de arriba lo fuerza.
    if (!tokens.refresh_token) {
      console.warn("Google no devolvió refresh_token. Revisa el prompt.");
    }

    // Guardar en la DB
    await prisma.professional.update({
      where: { id: professionalId },
      data: {
        googleRefreshToken: tokens.refresh_token, // Guardamos la joya de la corona
        googleAccessToken: tokens.access_token,   // Opcional, caduca rápido
        emailVerified: true // Asumimos que si conectó Google, el email es válido
      }
    });

    revalidatePath('/panel/profesional');
    return { success: true };

  } catch (error) {
    console.error("Error guardando tokens:", error);
    return { error: "Error al conectar con Google" };
  }
}
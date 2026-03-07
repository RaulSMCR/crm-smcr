// src/actions/google-connect-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { getOAuth2Client } from "@/lib/google-oauth";
import { revalidatePath } from "next/cache";
import { requireProfessionalProfileId } from "@/lib/auth-guards";

/** 1) Generar URL de autorizaciÃ³n */
export async function generarUrlConexionGoogle() {
  const oauth2Client = getOAuth2Client();

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    prompt: "consent",
    include_granted_scopes: true,
  });

  return url;
}

/** 2) Intercambiar code por tokens y guardar refresh_token */
export async function guardarCredencialesGoogle(code) {
  const professionalId = await requireProfessionalProfileId();
  if (!code) return { error: "Falta el parÃ¡metro 'code'." };

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(String(code));

    if (!tokens.refresh_token) {
      return {
        error:
          "Google no devolviÃ³ refresh_token. SoluciÃ³n tÃ­pica: desconecte la app en la cuenta de Google y vuelva a conectar.",
      };
    }

    await prisma.professionalProfile.update({
      where: { id: String(professionalId) },
      data: { googleRefreshToken: tokens.refresh_token },
    });

    revalidatePath("/panel/profesional");
    return { success: true };
  } catch (err) {
    console.error("Error guardando tokens Google:", err);
    return { error: "Error al conectar con Google." };
  }
}


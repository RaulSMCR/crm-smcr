// src/actions/google-connect-actions.js
'use server';

import { getOAuth2Client } from "@/lib/google-oauth";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function getProIdOrFail(session) {
  if (!session || session.role !== "PROFESSIONAL" || !session.professionalProfileId) {
    return null;
  }
  return String(session.professionalProfileId);
}

/** 1) Generar URL de autorización (Botón "Conectar") */
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

/** 2) Intercambiar Code por Tokens y guardar refresh_token en ProfessionalProfile */
export async function guardarCredencialesGoogle(code) {
  const session = await getSession();
  const proId = getProIdOrFail(session);

  if (!proId) return { error: "No autorizado" };
  if (!code) return { error: "Falta el parámetro 'code'." };

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(String(code));

    if (!tokens.refresh_token) {
      return {
        error:
          "Google no devolvió refresh_token. Reintenta: desconecta la app en tu cuenta Google y vuelve a conectar.",
      };
    }

    await prisma.professionalProfile.update({
      where: { id: proId },
      data: { googleRefreshToken: tokens.refresh_token },
    });

    revalidatePath("/panel/profesional");
    return { success: true };
  } catch (error) {
    console.error("Error guardando tokens:", error);
    return { error: "Error al conectar con Google" };
  }
}

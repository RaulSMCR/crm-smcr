// src/actions/google-connect-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { getOAuth2Client } from "@/lib/google-oauth";
import { getCalendarClient } from "@/lib/google";
import { revalidatePath } from "next/cache";
import { requireProfessionalProfileId } from "@/lib/auth-guards";

/** 1) Generar URL de autorización */
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

/** 3) Desconectar Google Calendar */
export async function desconectarGoogle() {
  const professionalId = await requireProfessionalProfileId();
  await prisma.professionalProfile.update({
    where: { id: String(professionalId) },
    data: { googleRefreshToken: null },
  });
  revalidatePath("/panel/profesional/integraciones");
  return { success: true };
}

/** ¿Este profesional ya tiene guardado un refresh_token utilizable? */
async function yaEstaConectado(professionalId) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: String(professionalId) },
    select: { googleRefreshToken: true },
  });
  return Boolean(profile?.googleRefreshToken);
}

/** 2) Intercambiar code por tokens y guardar refresh_token */
export async function guardarCredencialesGoogle(code) {
  const professionalId = await requireProfessionalProfileId();
  if (!code) return { error: "Falta el parámetro 'code'." };

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(String(code));

    // Google solo devuelve refresh_token la primera vez que se otorga el
    // consentimiento. Si no vino uno pero ya teníamos el anterior guardado, la
    // conexión sigue siendo válida: pisarlo con null sería romperla.
    if (!tokens.refresh_token) {
      if (await yaEstaConectado(professionalId)) {
        revalidatePath("/panel/profesional");
        return { success: true };
      }
      return {
        error:
          "Google no devolvió refresh_token. Solución típica: desconecte la app en la cuenta de Google y vuelva a conectar.",
      };
    }

    await prisma.professionalProfile.update({
      where: { id: String(professionalId) },
      data: { googleRefreshToken: tokens.refresh_token },
    });

    revalidatePath("/panel/profesional");
    return { success: true };
  } catch (err) {
    // Los códigos de autorización son de un solo uso. Si la página del callback
    // se ejecuta dos veces —un refresh, un prefetch del navegador, un doble
    // clic—, el segundo canje falla con `invalid_grant` aunque el primero haya
    // guardado el token. Eso mostraba "Conectado" y un error a la vez, que es
    // desconcertante y hacía creer que la integración no había funcionado.
    const motivo = err?.response?.data?.error || err?.message || "";

    if (motivo === "invalid_grant" && (await yaEstaConectado(professionalId))) {
      revalidatePath("/panel/profesional");
      return { success: true };
    }

    // El detalle de Google va al log del servidor: es lo único que permite
    // distinguir un código vencido de un secreto mal configurado.
    console.error("Error guardando tokens Google:", {
      error: err?.response?.data?.error,
      description: err?.response?.data?.error_description,
      message: err?.message,
    });

    const detalle = err?.response?.data?.error_description || motivo;
    return {
      error: detalle ? `No se pudo conectar con Google (${detalle}).` : "Error al conectar con Google.",
    };
  }
}

/** 4) Los calendarios de la cuenta, para que el profesional elija cuáles cuentan */
export async function listarCalendariosGoogle() {
  try {
    const professionalId = await requireProfessionalProfileId();

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: String(professionalId) },
      select: {
        googleRefreshToken: true,
        googleCalendarId: true,
        googleBusyCalendarIds: true,
      },
    });

    if (!profile?.googleRefreshToken) {
      return { success: false, error: "Conecte Google Calendar primero.", data: [] };
    }

    const calendar = getCalendarClient(profile.googleRefreshToken);
    const response = await calendar.calendarList.list({ maxResults: 250 });

    const calendarios = (response.data.items || []).map((item) => ({
      id: item.id,
      nombre: item.summary || item.id,
      esPrimary: Boolean(item.primary),
      // `owner` y `writer` permiten publicar; con `reader` o `freeBusyReader`
      // solo se puede mirar, así que no sirven como calendario de trabajo.
      puedeEscribir: item.accessRole === "owner" || item.accessRole === "writer",
      acceso: item.accessRole || "",
    }));

    return {
      success: true,
      data: {
        calendarios,
        calendarioDeTrabajo: profile.googleCalendarId || "primary",
        tambienOcupan: profile.googleBusyCalendarIds || [],
      },
    };
  } catch (error) {
    console.error("Error listando calendarios de Google:", error);
    return { success: false, error: "No se pudieron leer sus calendarios.", data: [] };
  }
}

/** 5) Guardar qué calendario usa y cuáles más le ocupan la agenda */
export async function guardarCalendariosGoogle({ calendarioDeTrabajo, tambienOcupan = [] }) {
  try {
    const professionalId = await requireProfessionalProfileId();

    const deTrabajo = String(calendarioDeTrabajo || "").trim() || "primary";
    const extras = [...new Set(
      (Array.isArray(tambienOcupan) ? tambienOcupan : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
        // El de trabajo ya se lee con detalle; repetirlo duplicaría cada banda.
        .filter((id) => id !== deTrabajo)
    )];

    await prisma.professionalProfile.update({
      where: { id: String(professionalId) },
      data: {
        googleCalendarId: deTrabajo === "primary" ? null : deTrabajo,
        googleBusyCalendarIds: extras,
      },
    });

    revalidatePath("/panel/profesional/integraciones");
    revalidatePath("/panel/profesional/horarios");
    revalidatePath("/panel/profesional/citas");
    return { success: true };
  } catch (error) {
    console.error("Error guardando calendarios de Google:", error);
    return { success: false, error: "No se pudo guardar la selección." };
  }
}

// src/lib/reenganche.js
// Volver a buscar a quien faltó.
//
// El problema que resuelve no es operativo, es clínico: la persona que falta a
// una cita y se encuentra con un cobro y una agenda cerrada casi nunca vuelve
// por su cuenta. No porque no quiera seguir, sino porque volver implica dar
// explicaciones, y dar explicaciones cuesta más que desaparecer.
//
// Por eso el primer mensaje sale solo, el mismo día, y por eso no menciona el
// cobro ni la política. Ese texto es de Raúl y va literal (ver
// MENSAJE_REINVITACION en lib/scheduling-block): lo que lo hace funcionar es
// justamente lo que no dice. Agregarle el monto "para que quede claro" lo
// convierte en una gestión de cobro y deja de servir.
//
// Después vienen dos recordatorios espaciados, y todo lo demás lo hace una
// persona. La bitácora existe para que "ya se le escribió" deje de ser un
// recuerdo de quien atendió el teléfono.

import { prisma } from "@/lib/prisma";
import { MENSAJE_REINVITACION } from "@/lib/scheduling-block";
import { scheduleReengagement } from "@/lib/qstash";
import {
  CANALES,
  DIAS_DE_SEGUIMIENTO,
  RESULTADOS_QUE_CIERRAN,
  diasDesde,
} from "@/lib/reenganche-policy";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";

/**
 * ¿Ya volvió a agendar desde que faltó?
 *
 * Si volvió, la secuencia se corta: seguir mandando "no desistás" a alguien que
 * ya reservó es la mejor forma de que se arrepienta.
 */
export async function yaVolvioAAgendar(patientId, desde) {
  const posteriores = await prisma.appointment.count({
    where: {
      patientId: String(patientId),
      createdAt: { gt: new Date(desde) },
      status: { notIn: ["CANCELLED_BY_USER", "CANCELLED_BY_PRO", "NO_SHOW"] },
    },
  });
  return posteriores > 0;
}

/** Deja el contacto anotado en la bitácora. Nunca lanza. */
export async function registrarContacto({
  patientId,
  appointmentId = null,
  canal,
  automatico = false,
  intento = 0,
  resultado = null,
  nota = null,
  registradoPor = null,
}) {
  try {
    return await prisma.contactoReenganche.create({
      data: {
        patientId: String(patientId),
        appointmentId,
        canal,
        automatico,
        intento,
        resultado,
        nota,
        registradoPor,
      },
    });
  } catch (error) {
    console.error("registrarContacto error:", error);
    return null;
  }
}

/**
 * El correo del mismo día.
 *
 * Sin encabezado institucional, sin logo grande, sin "estimado usuario". Se
 * parece a un mensaje de una persona porque tiene que serlo.
 */
export function correoDeReinvitacion({ nombre, urlAgenda }) {
  const saludo = nombre ? `Hola ${String(nombre).split(" ")[0]},` : "Hola,";
  const enlace = urlAgenda || `${APP_URL}/panel/paciente`;

  return `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.7;">
      <p style="font-size:16px;">${saludo}</p>
      <p style="font-size:17px;">${MENSAJE_REINVITACION}.</p>
      <p style="margin:28px 0;">
        <a href="${enlace}"
           style="background:#2b7073;color:#fff;padding:12px 26px;text-decoration:none;border-radius:8px;font-family:sans-serif;font-size:15px;">
          Volver a mi espacio
        </a>
      </p>
      <p style="font-size:14px;color:#6b7280;font-family:sans-serif;">
        Si preferís que te escribamos nosotros, respondé este correo y coordinamos.
      </p>
    </div>
  `;
}

async function enviarCorreo({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_dummy_key") {
    console.warn("[reenganche] RESEND_API_KEY no configurada, se omite el envío.");
    return false;
  }
  try {
    const { resend } = await import("@/lib/resend");
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("[reenganche] No se pudo enviar el correo:", error);
    return false;
  }
}

/**
 * Arranca la secuencia al marcarse una inasistencia.
 *
 * Manda el primero y programa los otros dos. Nunca lanza: que falle el
 * reenganche no puede impedir que la cita quede marcada como no asistida.
 */
export async function iniciarReenganche(appointment) {
  try {
    const patientId = appointment?.patientId || appointment?.patient?.id;
    const email = appointment?.patient?.email;
    if (!patientId) return;

    const urlAgenda = appointment?.professionalId
      ? `${APP_URL}/agendar/${appointment.professionalId}`
      : `${APP_URL}/panel/paciente`;

    const enviado = email
      ? await enviarCorreo({
          to: email,
          subject: "Tu espacio sigue acá",
          html: correoDeReinvitacion({ nombre: appointment?.patient?.name, urlAgenda }),
        })
      : false;

    if (enviado) {
      await registrarContacto({
        patientId,
        appointmentId: appointment.id,
        canal: CANALES.EMAIL,
        automatico: true,
        intento: 0,
      });
    }

    for (const [indice, dias] of DIAS_DE_SEGUIMIENTO.entries()) {
      await scheduleReengagement({
        patientId,
        appointmentId: appointment.id,
        intento: indice + 1,
        sendAt: new Date(Date.now() + dias * 24 * 60 * 60 * 1000),
      });
    }
  } catch (error) {
    console.error("iniciarReenganche error:", error);
  }
}

/**
 * Un recordatorio de la secuencia, disparado por QStash.
 *
 * Comprueba antes de escribir: si la persona ya volvió a agendar, o si alguien
 * la contactó y anotó que no quiere continuar, no se le manda nada más.
 */
export async function enviarSeguimiento({ patientId, appointmentId, intento }) {
  const cita = appointmentId
    ? await prisma.appointment.findUnique({
        where: { id: String(appointmentId) },
        select: { id: true, date: true, professionalId: true },
      })
    : null;

  const desde = cita?.date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (await yaVolvioAAgendar(patientId, desde)) {
    return { enviado: false, motivo: "YA_REAGENDO" };
  }

  const cerrado = await prisma.contactoReenganche.findFirst({
    where: {
      patientId: String(patientId),
      resultado: { in: [...RESULTADOS_QUE_CIERRAN] },
      createdAt: { gt: new Date(desde) },
    },
    select: { id: true },
  });
  if (cerrado) return { enviado: false, motivo: "CONVERSACION_CERRADA" };

  const paciente = await prisma.user.findUnique({
    where: { id: String(patientId) },
    select: { name: true, email: true },
  });
  if (!paciente?.email) return { enviado: false, motivo: "SIN_CORREO" };

  const urlAgenda = cita?.professionalId
    ? `${APP_URL}/agendar/${cita.professionalId}`
    : `${APP_URL}/panel/paciente`;

  const enviado = await enviarCorreo({
    to: paciente.email,
    subject: "Tu espacio sigue acá",
    html: correoDeReinvitacion({ nombre: paciente.name, urlAgenda }),
  });

  if (enviado) {
    await registrarContacto({
      patientId,
      appointmentId: cita?.id || null,
      canal: CANALES.EMAIL,
      automatico: true,
      intento: Number(intento) || 1,
    });
  }

  return { enviado, motivo: enviado ? null : "ENVIO_FALLIDO" };
}

/** Días transcurridos desde el último contacto. null si nunca se lo contactó. */
export const diasSinContacto = diasDesde;

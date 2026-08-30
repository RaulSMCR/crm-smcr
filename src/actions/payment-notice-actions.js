// src/actions/payment-notice-actions.js
// Avisos de pago acreditado para el paciente.
//
// El paciente casi nunca está mirando la app cuando ONVO confirma el cobro: paga
// desde el enlace que le llegó por correo y el webhook entra segundos o minutos
// después. Por eso el aviso no se emite en el momento sino que queda esperando,
// y se muestra la próxima vez que entra.
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { paymentTypeLabel } from "@/lib/payment-requests";
import { detalleLugarCita } from "@/lib/lugar-cita";

/**
 * Devuelve los pagos acreditados que el paciente todavía no vio y los marca como
 * avisados en el mismo paso.
 *
 * Se marcan aunque el usuario cierre la pestaña sin llegar a ver el toast: es
 * preferible perder un aviso a repetirlo en cada carga, que resulta molesto y
 * hace dudar de si el pago se duplicó.
 */
export async function consumirAvisosDePago() {
  try {
    const session = await getSession();
    if (!session?.sub || session.role !== "USER") return { avisos: [] };

    const pendientes = await prisma.paymentTransaction.findMany({
      where: {
        patientId: String(session.sub),
        status: "APPROVED",
        patientNotifiedAt: null,
      },
      orderBy: { paidAt: "asc" },
      select: {
        id: true,
        type: true,
        amount: true,
        currency: true,
        paidAt: true,
        appointment: {
          select: {
            date: true,
            paymentStatus: true,
            locationName: true,
            locationAddress: true,
            locationNotes: true,
            modality: true,
            service: { select: { title: true } },
            professional: { select: { user: { select: { name: true } } } },
          },
        },
      },
    });

    if (pendientes.length === 0) return { avisos: [] };

    await prisma.paymentTransaction.updateMany({
      where: { id: { in: pendientes.map((p) => p.id) } },
      data: { patientNotifiedAt: new Date() },
    });

    return {
      avisos: pendientes.map((pago) => ({
        id: pago.id,
        tipo: pago.type,
        etiqueta: paymentTypeLabel(pago.type),
        monto: Number(pago.amount),
        moneda: pago.currency || "CRC",
        pagadoEn: pago.paidAt ? pago.paidAt.toISOString() : null,

        // Un adelanto deja la cita reservada pero con saldo pendiente; el saldo
        // o el pago completo la dejan saldada. El texto del aviso cambia según eso.
        quedaSaldo: pago.appointment?.paymentStatus === "PARTIALLY_PAID",

        cita: pago.appointment
          ? {
              fecha: pago.appointment.date.toISOString(),
              servicio: pago.appointment.service?.title || "Consulta",
              profesional: pago.appointment.professional?.user?.name || null,
              // El lugar completo, no solo el rótulo: este aviso aparece
              // justo después de pagar y es el primer sitio donde la persona
              // busca a dónde tiene que ir.
              lugar: detalleLugarCita(pago.appointment),
              modalidad: pago.appointment.modality || null,
            }
          : null,
      })),
    };
  } catch (error) {
    console.error("consumirAvisosDePago error:", error);
    return { avisos: [] };
  }
}

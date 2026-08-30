import { prisma } from "@/lib/prisma";
import { sendPaymentRequestEmail } from "@/lib/appointments";
import { buildPaymentLinkUrl, createPaymentLink } from "@/lib/onvo/client";
import { resolveBookingSelection } from "@/lib/booking-rates";
import { nombreDelProfesional, paymentTypeLabel, rotuloCobroOnvo } from "@/lib/detalle-consulta";

// El rótulo del cobro se redacta en detalle-consulta.js junto con el detalle de
// la factura, para que digan lo mismo. Se reexporta desde acá porque media
// docena de módulos ya lo importaban de este archivo.
export { paymentTypeLabel };

export const ACTIVE_PAYMENT_STATUSES = ["PENDING", "LINK_SENT"];

export function splitFirstAppointmentAmount(amount) {
  const totalCents = Math.round(Number(amount || 0) * 100);
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return { deposit: 0, balance: 0 };
  }

  const depositCents = Math.round(totalCents / 2);
  const balanceCents = totalCents - depositCents;

  return {
    deposit: depositCents / 100,
    balance: balanceCents / 100,
  };
}

export function amountForPaymentType(type, totalAmount) {
  if (type === "DEPOSIT_50") return splitFirstAppointmentAmount(totalAmount).deposit;
  if (type === "BALANCE_50") return splitFirstAppointmentAmount(totalAmount).balance;
  // La multa por aviso tardío es el mismo 50%, así que usa el mismo reparto: si
  // se calculara aparte, el redondeo podría diferir en un colón de lo cobrado
  // como adelanto sobre la misma cita.
  if (type === "PENALTY_50") return splitFirstAppointmentAmount(totalAmount).deposit;
  return Number(totalAmount || 0);
}

/**
 * Precio de una cita que quedó sin `pricePaid`. Prefiere la tarifa que se le
 * enlazó al agendar; si ya no existe, resuelve la que rige para su lugar y hora.
 */
async function resolveFallbackPrice(appointment) {
  if (appointment.rateId) {
    const rate = await prisma.professionalRate.findUnique({
      where: { id: appointment.rateId },
      select: { approvedPrice: true, status: true },
    });
    if (rate?.status === "APPROVED" && Number(rate.approvedPrice) > 0) {
      return Number(rate.approvedPrice);
    }
  }

  const selection = await resolveBookingSelection({
    professionalId: appointment.professionalId,
    serviceId: appointment.serviceId,
    startsAt: new Date(appointment.date),
    locationId: appointment.locationId || null,
  });

  return selection?.data?.pricePaid ? Number(selection.data.pricePaid) : 0;
}

async function resolvePriceForAppointment(appointment) {
  if (appointment.pricePaid && Number(appointment.pricePaid) > 0) {
    return Number(appointment.pricePaid);
  }

  // Respaldo para citas viejas sin `pricePaid`: se recupera desde la tarifa que
  // quedó enlazada, o de la que rige ese lugar y esa hora.
  if (appointment.serviceId && appointment.professionalId) {
    const price = await resolveFallbackPrice(appointment).catch(() => 0);

    if (price > 0) {
      await prisma.appointment
        .update({ where: { id: appointment.id }, data: { pricePaid: price } })
        .catch(() => {});
      return price;
    }
  }

  return 0;
}

/**
 * Completa la cita con el profesional y su título profesional.
 *
 * Las citas llegan a esta función hidratadas de formas distintas según quién las
 * trajo: unas con `professional.user.name`, otras sin el profesional del todo.
 * El rótulo del cobro tiene que nombrar a quien atiende, y ese dato no puede
 * depender de por dónde entró la cita, así que se completa desde la base cuando
 * falta. Es una consulta por cobro emitido, no por cita listada.
 */
async function conProfesional(appointment) {
  if (appointment?.professional?.user?.name && "academicDegree" in appointment.professional) {
    return appointment;
  }
  if (!appointment?.professionalId) return appointment;

  // Si la consulta falla, el cobro sigue: el rótulo nombra a quien atiende, pero
  // un rótulo incompleto es infinitamente mejor que una cita que se quedó sin
  // enlace de pago.
  try {
    const professional = await prisma.professionalProfile.findUnique({
      where: { id: appointment.professionalId },
      select: { academicDegree: true, user: { select: { name: true } } },
    });
    return professional ? { ...appointment, professional } : appointment;
  } catch (error) {
    console.error("[payment] No se pudo leer el profesional para el rótulo:", error);
    return appointment;
  }
}

async function emailPaymentRequest({ appointment, paymentUrl, amount, paymentType }) {
  await sendPaymentRequestEmail({
    patientName: appointment.patient?.name,
    patientEmail: appointment.patient?.email,
    processUrl: paymentUrl,
    amount,
    serviceTitle: appointment.service?.title || "Consulta",
    proName: nombreDelProfesional(appointment.professional) || "el profesional",
    isFirst: appointment.isFirstWithProfessional,
    paymentType,
  });
}

export async function createPaymentRequestForAppointment(appointmentEntrante, requestedType) {
  if (!appointmentEntrante?.id) {
    return { success: false, error: "Cita invalida.", code: "INVALID_APPOINTMENT" };
  }

  // Se hidrata antes de la bifurcación: el correo del enlace reenviado nombra al
  // profesional igual que el del enlace nuevo.
  const appointment = await conProfesional(appointmentEntrante);

  // Un cobro ya emitido se reenvía con SU enlace: crear uno nuevo dejaría dos
  // enlaces vivos por la misma cita y el pago podría entrar por el que no
  // esperamos.
  const active = await prisma.paymentTransaction.findFirst({
    where: {
      appointmentId: appointment.id,
      type: requestedType,
      status: { in: ACTIVE_PAYMENT_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    if (!active.onvoPaymentLinkId) {
      return {
        success: false,
        error: "El cobro existente no tiene enlace de pago asociado.",
        code: "MISSING_ONVO_LINK",
      };
    }

    const reusedUrl = buildPaymentLinkUrl(active.onvoPaymentLinkId);
    await emailPaymentRequest({
      appointment,
      paymentUrl: reusedUrl,
      amount: Number(active.amount),
      paymentType: active.type,
    });

    return {
      success: true,
      reused: true,
      paymentUrl: reusedUrl,
      amount: Number(active.amount),
      type: active.type,
    };
  }

  const totalAmount = await resolvePriceForAppointment(appointment);
  const amount = amountForPaymentType(requestedType, totalAmount);

  if (!amount || amount <= 0) {
    return {
      success: false,
      error: "No se pudo determinar el monto de la cita.",
      code: "MISSING_AMOUNT",
    };
  }

  // Enlace propio de este cobro, por el monto congelado en la cita. Su ID es
  // además la llave con la que el webhook reconoce a qué transacción acreditar.
  let link;
  try {
    link = await createPaymentLink({
      amount,
      description: rotuloCobroOnvo(appointment, requestedType),
      currency: "CRC",
    });
  } catch (error) {
    console.error("[payment] No se pudo crear el enlace ONVO:", error);
    return {
      success: false,
      error: "No se pudo generar el enlace de pago con ONVO.",
      code: "ONVO_LINK_FAILED",
    };
  }

  const paymentUrl = link.url;

  await prisma.paymentTransaction.create({
    data: {
      appointmentId: appointment.id,
      professionalId: appointment.professionalId,
      patientId: appointment.patientId,
      type: requestedType,
      amount,
      currency: "CRC",
      onvoPaymentLinkId: link.id,
      status: "LINK_SENT",
    },
  });

  await emailPaymentRequest({
    appointment,
    paymentUrl,
    amount,
    paymentType: requestedType,
  });

  return {
    success: true,
    reused: false,
    paymentUrl,
    amount,
    type: requestedType,
  };
}

export function paymentRequestMessage(result) {
  const label = paymentTypeLabel(result?.type);
  return result?.reused
    ? `Enlace de ${label} reenviado al paciente por email.`
    : `Enlace de ${label} enviado al paciente por email.`;
}

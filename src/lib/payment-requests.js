import { prisma } from "@/lib/prisma";
import { sendPaymentRequestEmail } from "@/lib/appointments";
import { buildPaymentLinkUrl, createPaymentLink } from "@/lib/onvo/client";
import { resolveBookingSelection } from "@/lib/booking-rates";

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
  return Number(totalAmount || 0);
}

export function paymentTypeLabel(type) {
  if (type === "DEPOSIT_50") return "adelanto 50%";
  if (type === "BALANCE_50") return "saldo 50%";
  return "pago 100%";
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
 * Rótulo que ve el paciente en el checkout de ONVO. Incluye lugar y fecha para
 * que el cargo sea reconocible en el estado de cuenta.
 * Sin tildes ni guiones largos: ONVO devuelve el nombre con la codificación rota.
 */
function describeCharge(appointment, paymentType) {
  const parts = [
    paymentTypeLabel(paymentType),
    appointment.service?.title || "Consulta",
    appointment.locationName,
    appointment.date
      ? new Intl.DateTimeFormat("es-CR", {
          timeZone: "America/Costa_Rica",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(appointment.date))
      : null,
  ].filter(Boolean);

  return parts
    .join(" - ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function emailPaymentRequest({ appointment, paymentUrl, amount, paymentType }) {
  await sendPaymentRequestEmail({
    patientName: appointment.patient?.name,
    patientEmail: appointment.patient?.email,
    processUrl: paymentUrl,
    amount,
    serviceTitle: appointment.service?.title || "Consulta",
    proName: appointment.professional?.user?.name || "el profesional",
    isFirst: appointment.isFirstWithProfessional,
    paymentType,
  });
}

export async function createPaymentRequestForAppointment(appointment, requestedType) {
  if (!appointment?.id) {
    return { success: false, error: "Cita invalida.", code: "INVALID_APPOINTMENT" };
  }

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
      description: describeCharge(appointment, requestedType),
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

import { prisma } from "@/lib/prisma";
import { sendPaymentRequestEmail } from "@/lib/appointments";
import { buildPaymentLinkUrl } from "@/lib/onvo/client";

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

async function resolvePriceForAppointment(appointment) {
  if (appointment.pricePaid && Number(appointment.pricePaid) > 0) {
    return Number(appointment.pricePaid);
  }

  if (appointment.serviceId && appointment.professionalId) {
    const assignment = await prisma.serviceAssignment
      .findUnique({
        where: {
          professionalId_serviceId: {
            professionalId: appointment.professionalId,
            serviceId: appointment.serviceId,
          },
        },
        select: { approvedSessionPrice: true },
      })
      .catch(() => null);

    const price = assignment?.approvedSessionPrice
      ? Number(assignment.approvedSessionPrice)
      : 0;

    if (price > 0) {
      await prisma.appointment
        .update({ where: { id: appointment.id }, data: { pricePaid: price } })
        .catch(() => {});
      return price;
    }
  }

  return 0;
}

async function resolveOnvoPaymentLinkId(appointment) {
  if (!appointment.serviceId || !appointment.professionalId) return null;

  const assignment = await prisma.serviceAssignment.findUnique({
    where: {
      professionalId_serviceId: {
        professionalId: appointment.professionalId,
        serviceId: appointment.serviceId,
      },
    },
    select: { onvoPaymentLinkId: true },
  });

  return assignment?.onvoPaymentLinkId || null;
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

  const onvoLinkId = await resolveOnvoPaymentLinkId(appointment);
  if (!onvoLinkId) {
    return {
      success: false,
      error: "El profesional no tiene un enlace de pago ONVO configurado.",
      code: "MISSING_ONVO_LINK",
    };
  }

  const paymentUrl = buildPaymentLinkUrl(onvoLinkId);
  const active = await prisma.paymentTransaction.findFirst({
    where: {
      appointmentId: appointment.id,
      type: requestedType,
      status: { in: ACTIVE_PAYMENT_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });

  if (active) {
    await emailPaymentRequest({
      appointment,
      paymentUrl,
      amount: Number(active.amount),
      paymentType: active.type,
    });

    return {
      success: true,
      reused: true,
      paymentUrl,
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

  await prisma.paymentTransaction.create({
    data: {
      appointmentId: appointment.id,
      professionalId: appointment.professionalId,
      patientId: appointment.patientId,
      type: requestedType,
      amount,
      currency: "CRC",
      onvoPaymentLinkId: onvoLinkId,
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

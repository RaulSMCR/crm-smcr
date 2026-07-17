// Builders server-side de eventos Meta CAPI que necesitan datos de la DB
// (Schedule y Purchase). Cargan solo lo mínimo: identificadores para hashear +
// UTMs (y monto para Purchase). NUNCA leen ni envían datos clínicos.
//
// Todas son resilientes (try/catch propio) y pensadas para invocarse
// fire-and-forget con `after()` de next/server.
import { prisma } from "@/lib/prisma";
import { sendMetaEvent, utmCustomData } from "@/lib/meta-capi";

const USER_SELECT = {
  email: true,
  phone: true,
  utmSource: true,
  utmMedium: true,
  utmCampaign: true,
  utmContent: true,
  utmTerm: true,
};

/**
 * Evento Schedule: se agendó una cita. eventId determinístico por cita para
 * deduplicar con el píxel cliente (trackSchedule) cuando se le agregue eventID.
 */
export async function sendScheduleMeta(appointmentId) {
  try {
    const id = String(appointmentId || "");
    if (!id) return;
    const appt = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, patient: { select: USER_SELECT } },
    });
    if (!appt) return;
    const u = appt.patient || {};
    await sendMetaEvent({
      eventName: "Schedule",
      eventId: `schedule:${appt.id}`,
      userData: { email: u.email, phone: u.phone },
      customData: utmCustomData(u),
    });
  } catch (error) {
    console.error("[meta-capi] sendScheduleMeta:", error);
  }
}

/**
 * Evento Purchase: se pagó el adelanto. value = monto realmente pagado de la
 * transacción (el 50%), currency de la transacción. Si no hay monto válido, se
 * envía sin value (según requisito). eventId determinístico por transacción.
 */
export async function sendPurchaseMeta(transactionId) {
  try {
    const id = String(transactionId || "");
    if (!id) return;
    const tx = await prisma.paymentTransaction.findUnique({
      where: { id },
      select: { id: true, amount: true, currency: true, patient: { select: USER_SELECT } },
    });
    if (!tx) return;
    const u = tx.patient || {};
    const value = Number(tx.amount);
    const hasValue = Number.isFinite(value) && value > 0;
    await sendMetaEvent({
      eventName: "Purchase",
      eventId: `purchase:${tx.id}`,
      userData: { email: u.email, phone: u.phone },
      customData: {
        ...utmCustomData(u),
        ...(hasValue ? { value, currency: tx.currency || "CRC" } : {}),
      },
    });
  } catch (error) {
    console.error("[meta-capi] sendPurchaseMeta:", error);
  }
}

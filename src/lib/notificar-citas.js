// src/lib/notificar-citas.js
//
// Avisos de un lote de citas recién creadas, confirmadas o movidas: Google, un
// solo correo por destinatario y los recordatorios de cada cita. Lo usaban tres
// copias idénticas en agenda-actions, booking-actions y patient-booking-actions.

import { sendSeriesNotifications, sincronizarCitasConGoogle } from "@/lib/appointments";
import { scheduleReminder } from "@/lib/qstash";
import { recordatoriosDeCita } from "@/lib/recordatorios";

export async function notificarCitas(citas, reason, { titulo = null } = {}) {
  await Promise.allSettled([
    sincronizarCitasConGoogle(citas),
    sendSeriesNotifications(citas, reason, { titulo }),
    ...citas.flatMap((cita) => recordatoriosDeCita(cita).map(scheduleReminder)),
  ]);
}

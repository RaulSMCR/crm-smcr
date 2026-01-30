'use server'

import { getAvailableSlots } from "@/lib/booking-logic";

/**
 * Server Action: Devuelve slots disponibles.
 * Recibe la fecha como string (ISO) o timestamp para evitar problemas de serialización de Server Actions.
 */
export async function fetchSlots(professionalId, dateString, serviceDuration = 60) {
  if (!professionalId || !dateString) return { error: "Datos incompletos" };

  try {
    const date = new Date(dateString);
    const slots = await getAvailableSlots(professionalId, date, serviceDuration);
    return { success: true, slots };
  } catch (error) {
    console.error("Error fetching slots:", error);
    return { error: "Error al calcular disponibilidad." };
  }
}
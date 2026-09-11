// src/lib/price-ladder-server.js
// La parte de la escalera de precios que toca la base: ocupar un cupo cuando se
// acredita un pago. Las reglas del precio viven en src/lib/price-ladder.js.

import { prisma } from "@/lib/prisma";
import { escaleraCompleta } from "@/lib/price-ladder";
import { revalidarPreciosPublicos } from "@/lib/revalidar-precios";

function reservadaEnEscalon(cita) {
  return Boolean(cita?.priceTierId && cita.serviceId && Number(cita.pricePaid) > 0);
}

/**
 * Ocupa el cupo de escalera de una cita dentro de una transacción ya abierta.
 *
 * Es lo que usa el registro de pagos (src/lib/onvo/process-payment.js): el cupo
 * se ocupa en la misma transacción que aprueba el pago, así que un pago
 * registrado no puede quedar sin su inscripción, ni un reintento de ONVO que
 * llega como duplicado perderla.
 *
 * La cita trae el escalón con que se congeló su precio (`priceTierId`), que solo
 * se pone en la primera cita de un paciente nuevo. El paciente queda inscripto
 * con ese precio —lo conserva en sus sesiones siguientes— y el escalón suma un
 * cupo ocupado. Si se llenan todos, la escalera termina y rige la tarifa general.
 *
 * Idempotente: la inscripción es única por paciente, profesional y consulta.
 *
 * @param {object} tx    cliente de Prisma de la transacción
 * @param {{ id: string, patientId: string, professionalId: string, serviceId: string|null,
 *           pricePaid: *, priceTierId: string|null }} cita
 * @returns {Promise<{ ocupado: boolean, cambiaPrecio: boolean }>} `cambiaPrecio`
 *   avisa que el precio público cambió y hay que revalidar las páginas.
 */
export async function ocuparCupoEnTransaccion(tx, cita) {
  if (!reservadaEnEscalon(cita)) return { ocupado: false, cambiaPrecio: false };

  const clave = {
    patientId: cita.patientId,
    professionalId: cita.professionalId,
    serviceId: cita.serviceId,
  };

  const yaInscripto = await tx.priceLadderEnrollment.findUnique({
    where: { patientId_professionalId_serviceId: clave },
    select: { id: true },
  });
  if (yaInscripto) return { ocupado: false, cambiaPrecio: false };

  await tx.priceLadderEnrollment.create({
    data: { ...clave, tierId: cita.priceTierId, appointmentId: cita.id, price: cita.pricePaid },
  });

  const escalon = await tx.priceLadderTier.update({
    where: { id: cita.priceTierId },
    data: { seatsTaken: { increment: 1 } },
    select: { ladderId: true, seatsTaken: true, capacity: true },
  });

  const escalera = await tx.priceLadder.findUnique({
    where: { id: escalon.ladderId },
    select: { id: true, status: true, tiers: { select: { position: true, seatsTaken: true, capacity: true } } },
  });

  // Solo termina la escalera que rige. Un pago tardío sobre una escalera ya
  // reemplazada inscribe al paciente, pero no toca la que está vigente.
  const completa = escalera?.status === "APPROVED" && escaleraCompleta(escalera);
  if (completa) {
    await tx.priceLadder.update({
      where: { id: escalera.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
  }

  return {
    ocupado: true,
    // El precio público cambia justo cuando este pago llena el escalón.
    cambiaPrecio: escalon.seatsTaken === escalon.capacity || completa,
  };
}

/**
 * Lo mismo por fuera del registro de pagos: busca la cita, abre su propia
 * transacción y revalida las páginas si cambió el precio.
 *
 * Nunca lanza: un problema acá no puede impedir que siga el flujo que la llamó.
 */
export async function ocuparCupoDeEscalera(appointmentId) {
  try {
    const cita = await prisma.appointment.findUnique({
      where: { id: String(appointmentId || "") },
      select: {
        id: true,
        patientId: true,
        professionalId: true,
        serviceId: true,
        pricePaid: true,
        priceTierId: true,
      },
    });
    if (!reservadaEnEscalon(cita)) return { ocupado: false, cambiaPrecio: false };

    const resultado = await prisma.$transaction((tx) => ocuparCupoEnTransaccion(tx, cita));

    if (resultado.cambiaPrecio) revalidarPreciosPublicos();
    return resultado;
  } catch (error) {
    // P2002: otro proceso inscribió al mismo paciente al mismo tiempo.
    if (error?.code === "P2002") return { ocupado: false, cambiaPrecio: false };
    console.error("No se pudo ocupar el cupo de escalera:", { appointmentId, message: error?.message });
    return { ocupado: false, cambiaPrecio: false, error: true };
  }
}

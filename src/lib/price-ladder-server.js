// src/lib/price-ladder-server.js
// La parte de la escalera de precios que toca la base: ocupar un cupo cuando se
// acredita un pago. Las reglas del precio viven en src/lib/price-ladder.js.

import { prisma } from "@/lib/prisma";
import { escaleraCompleta } from "@/lib/price-ladder";
import { revalidarPreciosPublicos } from "@/lib/revalidar-precios";

/**
 * Ocupa el cupo de escalera de una cita cuando se acredita su pago.
 *
 * La cita trae el escalón con que se congeló su precio (`priceTierId`), que solo
 * se pone en la primera cita de un paciente nuevo. Al pagarse, el paciente queda
 * inscripto con ese precio —lo conserva en sus sesiones siguientes— y el escalón
 * suma un cupo ocupado. Si con eso el escalón se llena, cambia el precio público;
 * si se llenan todos, la escalera termina y rige la tarifa general.
 *
 * Idempotente: el webhook de ONVO reintenta y la conciliación manual puede
 * llegar después. La inscripción es única por paciente, profesional y consulta,
 * así que un segundo intento no suma otro cupo.
 *
 * Nunca lanza: un problema acá no puede impedir que se acredite un pago.
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
    if (!cita?.priceTierId || !cita.serviceId || !(Number(cita.pricePaid) > 0)) {
      return { ocupado: false, cambiaPrecio: false };
    }

    const resultado = await prisma.$transaction(async (tx) => {
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
    });

    if (resultado.cambiaPrecio) revalidarPreciosPublicos();
    return resultado;
  } catch (error) {
    // P2002: otro proceso inscribió al mismo paciente al mismo tiempo.
    if (error?.code === "P2002") return { ocupado: false, cambiaPrecio: false };
    console.error("No se pudo ocupar el cupo de escalera:", { appointmentId, message: error?.message });
    return { ocupado: false, cambiaPrecio: false, error: true };
  }
}

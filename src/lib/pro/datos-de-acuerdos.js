// src/lib/pro/datos-de-acuerdos.js
//
// Lo que necesita la sección «Acuerdos de atención»: los acuerdos activos del
// profesional, sus servicios y lugares, y si es Raúl (el único que fija un
// precio acordado y cobra fuera de ONVO). Lo usan el panel y la app.

import { prisma } from "@/lib/prisma";
import { ESTADOS_ACUERDO, puedeCobrarFueraDeOnvo } from "@/lib/acuerdos-de-atencion";

export async function datosDeAcuerdos(professionalId) {
  // Los servicios no exigen tarifa vigente: si falta, el alta lo dice con el
  // mensaje de la tarifa, en vez de esconder el servicio sin explicación.
  const [perfil, acuerdos, asignaciones, locations] = await Promise.all([
    prisma.professionalProfile.findUnique({ where: { id: professionalId }, select: { slug: true } }),
    prisma.acuerdoDeAtencion.findMany({
      where: { professionalId, estado: ESTADOS_ACUERDO.ACTIVO },
      orderBy: { inicio: "asc" },
      select: {
        id: true, periodicidad: true, inicio: true, precioAcordado: true, locationName: true,
        notas: true, gcalEventId: true, meetLink: true, cobroFueraDeOnvo: true,
        patient: { select: { name: true } },
        service: { select: { title: true } },
      },
    }),
    prisma.serviceAssignment.findMany({
      where: { professionalId, status: "APPROVED", service: { isActive: true } },
      select: { service: { select: { id: true, title: true, durationMin: true } } },
    }),
    prisma.practiceLocation.findMany({
      where: { professionalId, isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    acuerdos: acuerdos.map(({ patient, service, precioAcordado, ...a }) => ({
      ...a,
      precioAcordado: Number(precioAcordado),
      patientName: patient?.name || "Paciente",
      serviceTitle: service?.title || "Servicio",
    })),
    services: asignaciones.map((a) => a.service),
    locations,
    esGestionado: puedeCobrarFueraDeOnvo(perfil?.slug),
  };
}

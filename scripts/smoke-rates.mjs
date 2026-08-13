// Prueba de humo del modelo de tarifas contra la base real.
// Crea lugares, franjas y tarifas para un profesional, resuelve precios en
// distintas horas y modalidades, y limpia todo al final.
import { PrismaClient } from "@prisma/client";
import { resolveRate, resolveTimeBand, minutesOfDay } from "../src/lib/rates.js";

const p = new PrismaClient();
const created = { locations: [], bands: [], rates: [] };

function crc(n) {
  return new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 }).format(n);
}

try {
  // Hace falta uno que YA tenga la tarifa catch-all migrada, porque parte de lo
  // que se prueba es la caída en cascada hacia ella.
  const catchAll = await p.professionalRate.findFirst({
    where: { locationId: null, timeBandId: null, status: "APPROVED" },
  });
  if (!catchAll) throw new Error("No hay ninguna tarifa general para probar la cascada.");

  const assignment = await p.serviceAssignment.findUnique({
    where: {
      professionalId_serviceId: {
        professionalId: catchAll.professionalId,
        serviceId: catchAll.serviceId,
      },
    },
    include: { professional: { include: { user: { select: { name: true } } } }, service: true },
  });
  if (!assignment) throw new Error("No hay ninguna asignación aprobada para probar.");
  console.log(`Tarifa general vigente: ${crc(Number(catchAll.approvedPrice))}`);

  const { professionalId, serviceId } = assignment;
  console.log(`Profesional: ${assignment.professional.user.name} | Servicio: ${assignment.service.title}\n`);

  // ── Lugares ────────────────────────────────────────────────────────────────
  const oficina = await p.practiceLocation.create({
    data: { professionalId, name: "SMOKE Consultorio", modality: "OFFICE", address: "Escazú", displayOrder: 0 },
  });
  const virtual = await p.practiceLocation.create({
    data: { professionalId, name: "SMOKE Virtual", modality: "VIRTUAL", displayOrder: 1 },
  });
  const domicilio = await p.practiceLocation.create({
    data: { professionalId, name: "SMOKE Domicilio", modality: "HOME", displayOrder: 2 },
  });
  created.locations.push(oficina.id, virtual.id, domicilio.id);

  // ── Franjas ────────────────────────────────────────────────────────────────
  const matutino = await p.professionalTimeBand.create({
    data: { professionalId, name: "SMOKE Matutino", startTime: "07:00", endTime: "13:00" },
  });
  const vespertino = await p.professionalTimeBand.create({
    data: { professionalId, name: "SMOKE Vespertino", startTime: "13:00", endTime: "19:00" },
  });
  created.bands.push(matutino.id, vespertino.id);

  // ── Tarifas ────────────────────────────────────────────────────────────────
  // Catch-all ya existe de la migración (₡40.000). Agregamos las específicas.
  const nuevas = [
    { locationId: virtual.id, timeBandId: null, approvedPrice: 32000, label: "virtual, cualquier hora" },
    { locationId: domicilio.id, timeBandId: null, approvedPrice: 65000, label: "domicilio, cualquier hora" },
    { locationId: oficina.id, timeBandId: vespertino.id, approvedPrice: 48000, label: "oficina, vespertino" },
  ];

  for (const rate of nuevas) {
    const row = await p.professionalRate.create({
      data: {
        professionalId,
        serviceId,
        locationId: rate.locationId,
        timeBandId: rate.timeBandId,
        approvedPrice: rate.approvedPrice,
        proposedPrice: rate.approvedPrice,
        status: "APPROVED",
      },
    });
    created.rates.push(row.id);
    console.log(`  tarifa creada: ${rate.label} -> ${crc(rate.approvedPrice)}`);
  }

  // ── Resolución ─────────────────────────────────────────────────────────────
  const rates = await p.professionalRate.findMany({
    where: { professionalId, serviceId, status: "APPROVED" },
  });
  const bands = await p.professionalTimeBand.findMany({ where: { professionalId } });

  console.log("\nResolución de precios:\n");
  const casos = [
    ["2026-09-01T15:00:00Z", oficina.id, "Oficina 09:00 CR", 40000],
    ["2026-09-01T20:00:00Z", oficina.id, "Oficina 14:00 CR", 48000],
    ["2026-09-01T15:00:00Z", virtual.id, "Virtual 09:00 CR", 32000],
    ["2026-09-01T20:00:00Z", virtual.id, "Virtual 14:00 CR", 32000],
    ["2026-09-01T20:00:00Z", domicilio.id, "Domicilio 14:00 CR", 65000],
  ];

  let fallos = 0;
  for (const [iso, locationId, label, esperado] of casos) {
    const at = new Date(iso);
    const band = resolveTimeBand(bands, minutesOfDay(at));
    const rate = resolveRate(rates, { locationId, timeBandId: band?.id ?? null });
    const precio = rate ? Number(rate.approvedPrice) : null;
    const ok = precio === esperado;
    if (!ok) fallos += 1;
    console.log(
      `  ${ok ? "OK " : "MAL"} ${label.padEnd(22)} franja=${(band?.name || "ninguna").replace("SMOKE ", "").padEnd(12)} -> ${crc(precio ?? 0)} (esperado ${crc(esperado)})`
    );
  }

  console.log(fallos === 0 ? "\nTodos los casos resolvieron el precio esperado." : `\n${fallos} caso(s) fallaron.`);
} catch (error) {
  console.error("Error en la prueba:", error.message);
} finally {
  // Limpieza: las tarifas caen en cascada al borrar lugares y franjas, pero se
  // borran explícitamente por si alguna quedó colgada del catch-all.
  if (created.rates.length) await p.professionalRate.deleteMany({ where: { id: { in: created.rates } } });
  if (created.bands.length) await p.professionalTimeBand.deleteMany({ where: { id: { in: created.bands } } });
  if (created.locations.length) await p.practiceLocation.deleteMany({ where: { id: { in: created.locations } } });
  console.log("\nEscenario de prueba eliminado.");
  await p.$disconnect();
}

// tests/unit/booking-rates.test.js
// Opciones de modalidad y precio que se ofrecen al agendar, y la validación de
// la elección del paciente. Prisma está mockeado.
//
// El punto crítico: el precio se resuelve SIEMPRE en el servidor. Un cliente que
// mande otro lugar u otro monto no puede fijar lo que se le cobra.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    professionalRate: { findMany: vi.fn() },
    professionalTimeBand: { findMany: vi.fn() },
    practiceLocation: { findMany: vi.fn(), findFirst: vi.fn() },
    availability: { findMany: vi.fn() },
    priceLadder: { findFirst: vi.fn() },
    priceLadderEnrollment: { findUnique: vi.fn() },
    appointment: { count: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import { getBookingOptions, resolveBookingSelection } from "@/lib/booking-rates";

const PRO = "pro1";
const SVC = "svc1";

const OFICINA = { id: "loc_of", name: "Consultorio", modality: "OFFICE", address: "Escazú", instructions: null, isActive: true };
const VIRTUAL = { id: "loc_vi", name: "Virtual", modality: "VIRTUAL", address: null, instructions: "Enlace por correo", isActive: true };

const MATUTINO = { id: "band_am", name: "Matutino", startTime: "07:00", endTime: "13:00" };

// 2026-09-01T15:00:00Z = martes 09:00 en Costa Rica → franja matutina.
const MARTES_9AM = new Date("2026-09-01T15:00:00Z");

// 10 pacientes nuevos a ₡30.000 y 10 a ₡35.000.
const ESCALERA = {
  id: "esc",
  tiers: [
    { id: "t1", position: 1, price: 30000, capacity: 10, seatsTaken: 0 },
    { id: "t2", position: 2, price: 35000, capacity: 10, seatsTaken: 0 },
  ],
};

function rate(overrides) {
  return { id: "r", locationId: null, timeBandId: null, status: "APPROVED", approvedPrice: 40000, ...overrides };
}

function setup({
  rates = [],
  bands = [MATUTINO],
  locations = [OFICINA, VIRTUAL],
  availability = [],
  escalera = null,
  inscripcion = null,
  previas = 0,
} = {}) {
  prisma.professionalRate.findMany.mockResolvedValue(rates);
  prisma.professionalTimeBand.findMany.mockResolvedValue(bands);
  prisma.practiceLocation.findMany.mockResolvedValue(locations);
  prisma.availability.findMany.mockResolvedValue(availability);
  prisma.practiceLocation.findFirst.mockImplementation(async ({ where }) =>
    locations.find((loc) => loc.id === where.id) || null
  );
  prisma.priceLadder.findFirst.mockResolvedValue(escalera);
  prisma.priceLadderEnrollment.findUnique.mockResolvedValue(inscripcion);
  prisma.appointment.count.mockResolvedValue(previas);
}

beforeEach(() => vi.clearAllMocks());

describe("getBookingOptions()", () => {
  it("ofrece cada lugar con su propio precio", async () => {
    setup({
      rates: [
        rate({ id: "general", approvedPrice: 40000 }),
        rate({ id: "virtual", locationId: VIRTUAL.id, approvedPrice: 32000 }),
      ],
    });

    const { options } = await getBookingOptions({ professionalId: PRO, serviceId: SVC, startsAt: MARTES_9AM });

    expect(options).toHaveLength(2);
    expect(options.find((o) => o.locationId === OFICINA.id).price).toBe(40000);
    expect(options.find((o) => o.locationId === VIRTUAL.id).price).toBe(32000);
  });

  it("marca como no reservable el lugar sin tarifa que lo cubra", async () => {
    setup({ rates: [rate({ id: "solo_virtual", locationId: VIRTUAL.id, approvedPrice: 32000 })] });

    const { options } = await getBookingOptions({ professionalId: PRO, serviceId: SVC, startsAt: MARTES_9AM });

    const oficina = options.find((o) => o.locationId === OFICINA.id);
    expect(oficina.bookable).toBe(false);
    expect(oficina.price).toBeNull();
  });

  it("restringe los lugares a los declarados en el bloque de ese horario", async () => {
    setup({
      rates: [rate({ id: "general" })],
      availability: [
        {
          id: "av1",
          dayOfWeek: 2, // martes
          startTime: "08:00",
          endTime: "12:00",
          locations: [{ location: VIRTUAL }],
        },
      ],
    });

    const { options } = await getBookingOptions({ professionalId: PRO, serviceId: SVC, startsAt: MARTES_9AM });

    expect(options).toHaveLength(1);
    expect(options[0].locationId).toBe(VIRTUAL.id);
  });

  it("sin lugares declarados en el bloque ofrece todos los activos", async () => {
    setup({
      rates: [rate({ id: "general" })],
      availability: [{ id: "av1", dayOfWeek: 2, startTime: "08:00", endTime: "12:00", locations: [] }],
    });

    const { options } = await getBookingOptions({ professionalId: PRO, serviceId: SVC, startsAt: MARTES_9AM });
    expect(options).toHaveLength(2);
  });

  it("no expone la dirección en la modalidad a domicilio", async () => {
    const domicilio = { id: "loc_ho", name: "A domicilio", modality: "HOME", address: "no aplica", isActive: true };
    setup({
      rates: [rate({ id: "general" })],
      locations: [domicilio],
    });

    const { options } = await getBookingOptions({ professionalId: PRO, serviceId: SVC, startsAt: MARTES_9AM });
    expect(options[0].address).toBeNull();
  });
});

describe("resolveBookingSelection()", () => {
  it("congela precio y copia del lugar elegido", async () => {
    setup({
      rates: [
        rate({ id: "general", approvedPrice: 40000 }),
        rate({ id: "virtual", locationId: VIRTUAL.id, approvedPrice: 32000 }),
      ],
    });

    const res = await resolveBookingSelection({
      professionalId: PRO,
      serviceId: SVC,
      startsAt: MARTES_9AM,
      locationId: VIRTUAL.id,
    });

    expect(res.data).toMatchObject({
      pricePaid: 32000,
      rateId: "virtual",
      priceTierId: null,
      locationId: VIRTUAL.id,
      modality: "VIRTUAL",
      locationName: "Virtual",
      timeBandName: "Matutino",
    });
  });

  it("exige elegir cuando hay más de una modalidad", async () => {
    setup({ rates: [rate({ id: "general" })] });

    const res = await resolveBookingSelection({ professionalId: PRO, serviceId: SVC, startsAt: MARTES_9AM });
    expect(res.error).toMatch(/Seleccione dónde/i);
  });

  it("preselecciona cuando solo hay una modalidad", async () => {
    setup({ rates: [rate({ id: "general" })], locations: [OFICINA] });

    const res = await resolveBookingSelection({ professionalId: PRO, serviceId: SVC, startsAt: MARTES_9AM });
    expect(res.data.pricePaid).toBe(40000);
    expect(res.data.locationId).toBe(OFICINA.id);
  });

  it("rechaza un lugar que no se ofrece en ese horario", async () => {
    setup({
      rates: [rate({ id: "general" })],
      availability: [
        { id: "av1", dayOfWeek: 2, startTime: "08:00", endTime: "12:00", locations: [{ location: VIRTUAL }] },
      ],
    });

    const res = await resolveBookingSelection({
      professionalId: PRO,
      serviceId: SVC,
      startsAt: MARTES_9AM,
      locationId: OFICINA.id,
    });

    expect(res.error).toMatch(/no está disponible/i);
  });

  it("rechaza un lugar sin tarifa aprobada en vez de cobrar cualquier cosa", async () => {
    setup({ rates: [rate({ id: "solo_virtual", locationId: VIRTUAL.id, approvedPrice: 32000 })] });

    const res = await resolveBookingSelection({
      professionalId: PRO,
      serviceId: SVC,
      startsAt: MARTES_9AM,
      locationId: OFICINA.id,
    });

    expect(res.error).toMatch(/precio aprobado/i);
    expect(res.data).toBeUndefined();
  });

  it("no hay opciones si el profesional no tiene ninguna tarifa aprobada", async () => {
    setup({ rates: [] });

    const res = await resolveBookingSelection({
      professionalId: PRO,
      serviceId: SVC,
      startsAt: MARTES_9AM,
      locationId: OFICINA.id,
    });

    expect(res.error).toMatch(/precio aprobado/i);
  });
});

describe("escalera de precios al agendar", () => {
  const base = { professionalId: PRO, serviceId: SVC, startsAt: MARTES_9AM };

  it("un paciente nuevo reserva al escalón vigente y la cita guarda el escalón", async () => {
    setup({ rates: [rate({ id: "general" })], locations: [OFICINA], escalera: ESCALERA, previas: 0 });

    const res = await resolveBookingSelection({ ...base, patientId: "pac_nuevo" });

    expect(res.data).toMatchObject({ pricePaid: 30000, rateId: "general", priceTierId: "t1" });
  });

  it("quien ya entró en la escalera conserva su precio", async () => {
    setup({
      rates: [rate({ id: "general" })],
      locations: [OFICINA],
      escalera: { ...ESCALERA, tiers: ESCALERA.tiers.map((t) => ({ ...t, seatsTaken: 10 })) },
      inscripcion: { price: 30000 },
      previas: 3,
    });

    const res = await resolveBookingSelection({ ...base, patientId: "pac_inscripto" });

    expect(res.data).toMatchObject({ pricePaid: 30000, priceTierId: null });
  });

  it("un paciente que ya se atendía antes paga la tarifa normal", async () => {
    setup({ rates: [rate({ id: "general" })], locations: [OFICINA], escalera: ESCALERA, previas: 2 });

    const res = await resolveBookingSelection({ ...base, patientId: "pac_antiguo" });

    expect(res.data).toMatchObject({ pricePaid: 40000, priceTierId: null });
  });

  it("sin sesión se muestra el precio de un paciente nuevo", async () => {
    setup({ rates: [rate({ id: "general" })], locations: [OFICINA], escalera: ESCALERA });

    const { options } = await getBookingOptions(base);

    expect(options[0]).toMatchObject({ price: 30000, priceTierId: "t1" });
    expect(prisma.appointment.count).not.toHaveBeenCalled();
  });

  it("la escalera no cambia las tarifas por lugar", async () => {
    setup({
      rates: [
        rate({ id: "general" }),
        rate({ id: "virtual", locationId: VIRTUAL.id, approvedPrice: 32000 }),
      ],
      escalera: ESCALERA,
    });

    const { options } = await getBookingOptions({ ...base, patientId: "pac_nuevo" });

    expect(options.find((o) => o.locationId === OFICINA.id)).toMatchObject({ price: 30000, priceTierId: "t1" });
    expect(options.find((o) => o.locationId === VIRTUAL.id)).toMatchObject({ price: 32000, priceTierId: null });
  });
});

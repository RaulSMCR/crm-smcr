// tests/unit/price-ladder-server.test.js
// Ocupar el cupo de escalera cuando se acredita un pago. Prisma está mockeado.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, tx, revalidar } = vi.hoisted(() => {
  const tx = {
    priceLadderEnrollment: { findUnique: vi.fn(), create: vi.fn() },
    priceLadderTier: { update: vi.fn() },
    priceLadder: { findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    prisma: {
      appointment: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn) => fn(tx)),
    },
    revalidar: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/revalidar-precios", () => ({ revalidarPreciosPublicos: revalidar }));

import { ocuparCupoDeEscalera } from "@/lib/price-ladder-server";

const CITA = {
  id: "cita1",
  patientId: "pac1",
  professionalId: "pro1",
  serviceId: "svc1",
  pricePaid: 30000,
  priceTierId: "t1",
};

function escalera(ocupados) {
  return {
    id: "esc",
    status: "APPROVED",
    tiers: [
      { position: 1, capacity: 10, seatsTaken: ocupados[0] },
      { position: 2, capacity: 10, seatsTaken: ocupados[1] },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prisma.appointment.findUnique.mockResolvedValue(CITA);
  tx.priceLadderEnrollment.findUnique.mockResolvedValue(null);
});

describe("ocuparCupoDeEscalera()", () => {
  it("inscribe al paciente con el precio congelado y suma el cupo", async () => {
    tx.priceLadderTier.update.mockResolvedValue({ ladderId: "esc", seatsTaken: 4, capacity: 10 });
    tx.priceLadder.findUnique.mockResolvedValue(escalera([4, 0]));

    const res = await ocuparCupoDeEscalera("cita1");

    expect(tx.priceLadderEnrollment.create).toHaveBeenCalledWith({
      data: {
        patientId: "pac1",
        professionalId: "pro1",
        serviceId: "svc1",
        tierId: "t1",
        appointmentId: "cita1",
        price: 30000,
      },
    });
    expect(tx.priceLadderTier.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "t1" }, data: { seatsTaken: { increment: 1 } } })
    );
    expect(res).toEqual({ ocupado: true, cambiaPrecio: false });
    expect(revalidar).not.toHaveBeenCalled();
  });

  it("un reintento del webhook no suma otro cupo", async () => {
    tx.priceLadderEnrollment.findUnique.mockResolvedValue({ id: "ya-inscripto" });

    const res = await ocuparCupoDeEscalera("cita1");

    expect(tx.priceLadderEnrollment.create).not.toHaveBeenCalled();
    expect(tx.priceLadderTier.update).not.toHaveBeenCalled();
    expect(res.ocupado).toBe(false);
  });

  it("el pago que llena el escalón cambia el precio público", async () => {
    tx.priceLadderTier.update.mockResolvedValue({ ladderId: "esc", seatsTaken: 10, capacity: 10 });
    tx.priceLadder.findUnique.mockResolvedValue(escalera([10, 0]));

    const res = await ocuparCupoDeEscalera("cita1");

    expect(res.cambiaPrecio).toBe(true);
    expect(revalidar).toHaveBeenCalledTimes(1);
    expect(tx.priceLadder.update).not.toHaveBeenCalled();
  });

  it("al llenarse el último escalón la escalera termina", async () => {
    tx.priceLadderTier.update.mockResolvedValue({ ladderId: "esc", seatsTaken: 10, capacity: 10 });
    tx.priceLadder.findUnique.mockResolvedValue(escalera([10, 10]));

    await ocuparCupoDeEscalera("cita1");

    expect(tx.priceLadder.update).toHaveBeenCalledWith({
      where: { id: "esc" },
      data: { status: "ENDED", endedAt: expect.any(Date) },
    });
  });

  it("un pago tardío sobre un escalón ya lleno inscribe al paciente sin mover el precio", async () => {
    tx.priceLadderTier.update.mockResolvedValue({ ladderId: "esc", seatsTaken: 11, capacity: 10 });
    tx.priceLadder.findUnique.mockResolvedValue(escalera([11, 3]));

    const res = await ocuparCupoDeEscalera("cita1");

    expect(res).toEqual({ ocupado: true, cambiaPrecio: false });
  });

  it("no hace nada con una cita que no se reservó en un escalón", async () => {
    prisma.appointment.findUnique.mockResolvedValue({ ...CITA, priceTierId: null });

    const res = await ocuparCupoDeEscalera("cita1");

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(res.ocupado).toBe(false);
  });

  it("nunca lanza: registra el error y deja seguir la acreditación del pago", async () => {
    prisma.appointment.findUnique.mockRejectedValue(new Error("base caída"));
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(ocuparCupoDeEscalera("cita1")).resolves.toMatchObject({ ocupado: false, error: true });

    consola.mockRestore();
  });
});

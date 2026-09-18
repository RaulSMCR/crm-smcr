// tests/unit/service-assignment-precio.test.js
//
// Re-aprobar a un profesional ya aprobado no puede devolverle un precio viejo.
//
// La ficha del servicio manda `reviewServiceAssignment` con lo que haya en la
// fila. Cuando no venía precio, la acción caía a `proposedSessionPrice` —lo que
// el profesional pidió alguna vez— y lo estampaba en la tarifa general, que es
// de donde lee todo el sitio. Si el admin había negociado otro monto en
// /panel/admin/tarifas, un clic en «Aprobar / editar» se lo llevaba puesto sin
// avisar. Ahora manda la tarifa vigente; la propuesta solo rige la primera vez.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, getSession } = vi.hoisted(() => ({
  prisma: {
    service: { findUnique: vi.fn(), update: vi.fn() },
    serviceAssignment: { findUnique: vi.fn(), update: vi.fn() },
    professionalRate: { count: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    tax: { findUnique: vi.fn() },
  },
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ getSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/revalidar-precios", () => ({ revalidarPreciosPublicos: vi.fn() }));

import { reviewServiceAssignment } from "@/actions/service-actions";

const SVC = "svc1";
const PRO = "pro1";
const CATCH_ALL = "rate_catchall";

/** Precio con el que quedó la tarifa general tras la llamada. */
const precioFijado = () =>
  Number(prisma.professionalRate.update.mock.calls.at(-1)?.[0]?.data?.approvedPrice);

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ role: "ADMIN" });
  prisma.service.findUnique.mockResolvedValue({ cabysCode: "9319000000000", taxId: "tax_iva4" });
  prisma.serviceAssignment.findUnique.mockResolvedValue({ proposedSessionPrice: 30000 });
  prisma.serviceAssignment.update.mockResolvedValue({});
  prisma.professionalRate.update.mockResolvedValue({});
  prisma.professionalRate.create.mockResolvedValue({});
  prisma.tax.findUnique.mockResolvedValue({ id: "tax_iva4" });
});

describe("reviewServiceAssignment — precio de la tarifa general", () => {
  it("re-aprobar sin precio conserva la tarifa vigente, no la propuesta vieja", async () => {
    // Vigente negociada en 35.000; la propuesta del profesional sigue en 30.000.
    prisma.professionalRate.findFirst.mockResolvedValue({ id: CATCH_ALL, approvedPrice: 35000 });

    const res = await reviewServiceAssignment(SVC, PRO, { decision: "APPROVED" });

    expect(res.success).toBe(true);
    expect(precioFijado()).toBe(35000);
  });

  it("el precio que manda el admin gana sobre la vigente", async () => {
    prisma.professionalRate.findFirst.mockResolvedValue({ id: CATCH_ALL, approvedPrice: 35000 });

    await reviewServiceAssignment(SVC, PRO, { decision: "APPROVED", approvedSessionPrice: 2000 });

    expect(precioFijado()).toBe(2000);
  });

  it("sin tarifa todavía, la primera aprobación toma la propuesta", async () => {
    prisma.professionalRate.findFirst.mockResolvedValue(null);

    const res = await reviewServiceAssignment(SVC, PRO, { decision: "APPROVED" });

    expect(res.success).toBe(true);
    expect(Number(prisma.professionalRate.create.mock.calls.at(-1)[0].data.approvedPrice)).toBe(30000);
  });

  it("una tarifa vigente en cero no tapa la propuesta", async () => {
    // `approvedPrice` puede quedar nulo tras un rechazo; eso no es un precio.
    prisma.professionalRate.findFirst.mockResolvedValue({ id: CATCH_ALL, approvedPrice: null });

    await reviewServiceAssignment(SVC, PRO, { decision: "APPROVED" });

    expect(precioFijado()).toBe(30000);
  });

  it("rechazar no toca la tarifa", async () => {
    prisma.professionalRate.findFirst.mockResolvedValue({ id: CATCH_ALL, approvedPrice: 35000 });

    await reviewServiceAssignment(SVC, PRO, { decision: "REJECTED" });

    expect(prisma.professionalRate.update).not.toHaveBeenCalled();
    expect(prisma.professionalRate.create).not.toHaveBeenCalled();
  });
});

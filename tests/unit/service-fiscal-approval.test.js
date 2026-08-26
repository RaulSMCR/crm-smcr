// tests/unit/service-fiscal-approval.test.js
// Clasificar el servicio (CABYS + IVA) es parte de aprobar a un profesional:
// aprobar sin eso deja habilitado un cobro cuyas facturas salen incompletas.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, getSession } = vi.hoisted(() => ({
  prisma: {
    service: { findUnique: vi.fn(), update: vi.fn() },
    serviceAssignment: { findUnique: vi.fn(), update: vi.fn() },
    // Aprobar una asignación también garantiza que el profesional quede con una
    // tarifa cobrable (garantizarTarifaVigente), si no la ficha se publica sin
    // precio y sin agenda.
    professionalRate: { count: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    tax: { findUnique: vi.fn() },
  },
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ getSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { reviewServiceAssignment } from "@/actions/service-actions";

const SVC = "svc1";
const PRO = "pro1";
const CABYS = "9319000000000";
const TAX = "tax_iva4";

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ role: "ADMIN" });
  prisma.serviceAssignment.findUnique.mockResolvedValue({ proposedSessionPrice: 40000 });
  prisma.serviceAssignment.update.mockResolvedValue({});
  prisma.professionalRate.count.mockResolvedValue(0);
  prisma.professionalRate.findFirst.mockResolvedValue(null);
  prisma.professionalRate.create.mockResolvedValue({});
  prisma.service.update.mockResolvedValue({});
  prisma.tax.findUnique.mockResolvedValue({ id: TAX });
});

describe("reviewServiceAssignment — clasificación fiscal", () => {
  it("no aprueba un servicio sin CABYS ni IVA", async () => {
    prisma.service.findUnique.mockResolvedValue({ cabysCode: null, taxId: null });

    const res = await reviewServiceAssignment(SVC, PRO, { decision: "APPROVED" });

    expect(res.error).toMatch(/clasificar el servicio/i);
    expect(prisma.serviceAssignment.update).not.toHaveBeenCalled();
  });

  it("no aprueba si falta solo el IVA", async () => {
    prisma.service.findUnique.mockResolvedValue({ cabysCode: CABYS, taxId: null });

    const res = await reviewServiceAssignment(SVC, PRO, { decision: "APPROVED" });

    expect(res.error).toMatch(/clasificar el servicio/i);
    expect(prisma.serviceAssignment.update).not.toHaveBeenCalled();
  });

  it("clasifica el servicio con los valores enviados en la misma aprobación", async () => {
    prisma.service.findUnique.mockResolvedValue({ cabysCode: null, taxId: null });

    const res = await reviewServiceAssignment(SVC, PRO, {
      decision: "APPROVED",
      cabysCode: CABYS,
      taxId: TAX,
    });

    expect(res.success).toBe(true);
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: SVC },
      data: { cabysCode: CABYS, taxId: TAX },
    });
    expect(prisma.serviceAssignment.update).toHaveBeenCalled();
  });

  it("aprueba sin reescribir cuando el servicio ya estaba clasificado", async () => {
    prisma.service.findUnique.mockResolvedValue({ cabysCode: CABYS, taxId: TAX });

    const res = await reviewServiceAssignment(SVC, PRO, { decision: "APPROVED" });

    expect(res.success).toBe(true);
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it("rechaza un CABYS que no tiene 13 dígitos", async () => {
    prisma.service.findUnique.mockResolvedValue({ cabysCode: null, taxId: null });

    const res = await reviewServiceAssignment(SVC, PRO, {
      decision: "APPROVED",
      cabysCode: "123",
      taxId: TAX,
    });

    expect(res.error).toMatch(/13 dígitos/i);
    expect(prisma.serviceAssignment.update).not.toHaveBeenCalled();
  });

  it("rechaza un IVA inexistente", async () => {
    prisma.service.findUnique.mockResolvedValue({ cabysCode: null, taxId: null });
    prisma.tax.findUnique.mockResolvedValue(null);

    const res = await reviewServiceAssignment(SVC, PRO, {
      decision: "APPROVED",
      cabysCode: CABYS,
      taxId: "tax_inexistente",
    });

    expect(res.error).toMatch(/IVA seleccionado no existe/i);
  });

  it("rechazar una solicitud no exige clasificación", async () => {
    prisma.service.findUnique.mockResolvedValue({ cabysCode: null, taxId: null });

    const res = await reviewServiceAssignment(SVC, PRO, { decision: "REJECTED" });

    expect(res.success).toBe(true);
    expect(prisma.service.findUnique).not.toHaveBeenCalled();
  });
});

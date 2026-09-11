// tests/unit/precio-desde-perfil.test.js
// Cambiar el precio de una consulta ya aprobada, desde el perfil o desde
// Tarifas, no puede sacar al profesional del sitio. Prisma está mockeado.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, guards, auth } = vi.hoisted(() => {
  const op = (nombre) => vi.fn((args) => ({ op: nombre, args }));
  return {
    prisma: {
      professionalProfile: { findUnique: vi.fn(), update: op("profile.update") },
      service: { findMany: vi.fn() },
      serviceAssignment: {
        findMany: vi.fn(),
        create: op("assignment.create"),
        update: op("assignment.update"),
        delete: op("assignment.delete"),
      },
      professionalRate: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        create: op("rate.create"),
        update: op("rate.update"),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(async (ops) => ops),
    },
    guards: { requireProfessionalContext: vi.fn(), requireProfessionalProfileId: vi.fn() },
    auth: { getSession: vi.fn(), isPreviewSession: vi.fn(() => false), PREVIEW_BLOCKED_MESSAGE: "bloqueado" },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-guards", () => guards);
vi.mock("@/lib/auth", () => auth);

import { updateProfile } from "@/actions/profile-actions";
import { deleteRate } from "@/actions/practice-actions";

const PRO = "pro1";
const SVC = "svc1";

function formulario({ precio }) {
  const fd = new FormData();
  fd.append("name", "Profesional de prueba");
  fd.append("specialty", "Psicología clínica");
  fd.append("serviceIds", SVC);
  fd.append("proposedPrice", `${SVC}:${precio}`);
  return fd;
}

function escenario({
  asignacion = "APPROVED",
  tarifa = { status: "APPROVED", approvedPrice: 40000, proposedPrice: 40000 },
  catalogo = 40000,
} = {}) {
  guards.requireProfessionalContext.mockResolvedValue({ session: { slug: "pro" }, professionalProfileId: PRO });
  prisma.professionalProfile.findUnique.mockResolvedValue({
    slug: "pro",
    profileReview: null,
    profileReviewDraft: null,
    profileReviewStatus: "EMPTY",
  });
  prisma.service.findMany.mockResolvedValue([{ id: SVC, price: catalogo }]);
  prisma.serviceAssignment.findMany.mockResolvedValue(
    asignacion
      ? [{ serviceId: SVC, status: asignacion, proposedSessionPrice: 40000, approvedSessionPrice: 40000 }]
      : []
  );
  prisma.professionalRate.findMany.mockResolvedValue(tarifa ? [{ id: "general", serviceId: SVC, ...tarifa }] : []);
}

const operaciones = () => prisma.$transaction.mock.calls[0][0];

beforeEach(() => vi.clearAllMocks());

describe("updateProfile(): precio de una consulta aprobada", () => {
  it("no manda la asignación a revisión: propone el monto en la tarifa general", async () => {
    escenario();

    const res = await updateProfile(formulario({ precio: 30000 }));

    expect(res.success).toBe(true);
    expect(res.tarifasEnRevision).toBe(1);

    const ops = operaciones();
    expect(ops.some((o) => o.op === "assignment.update" && o.args.data.status === "PENDING")).toBe(false);

    const tarifa = ops.find((o) => o.op === "rate.update");
    expect(tarifa.args.where).toEqual({ id: "general" });
    expect(tarifa.args.data).toMatchObject({ proposedPrice: 30000, status: "PENDING" });
    // El precio aprobado no se toca: sigue rigiendo hasta la revisión.
    expect(tarifa.args.data).not.toHaveProperty("approvedPrice");
  });

  it("guardar el perfil con el mismo precio no genera ninguna propuesta", async () => {
    escenario();

    await updateProfile(formulario({ precio: 40000 }));

    expect(operaciones().some((o) => o.op.startsWith("rate."))).toBe(false);
  });

  it("volver al precio de catálogo se aprueba solo, igual que en Tarifas", async () => {
    escenario({ tarifa: { status: "APPROVED", approvedPrice: 45000, proposedPrice: 45000 }, catalogo: 40000 });

    const res = await updateProfile(formulario({ precio: 40000 }));

    const tarifa = operaciones().find((o) => o.op === "rate.update");
    expect(tarifa.args.data).toMatchObject({ status: "APPROVED", approvedPrice: 40000 });
    expect(res.tarifasEnRevision).toBe(0);
  });

  it("una consulta nueva sí espera la aprobación de la asignación", async () => {
    escenario({ asignacion: null });

    await updateProfile(formulario({ precio: 30000 }));

    const alta = operaciones().find((o) => o.op === "assignment.create");
    expect(alta.args.data).toMatchObject({ status: "PENDING", proposedSessionPrice: 30000 });
  });
});

describe("deleteRate()", () => {
  beforeEach(() => {
    auth.getSession.mockResolvedValue({ role: "PROFESSIONAL" });
    guards.requireProfessionalProfileId.mockResolvedValue(PRO);
  });

  it("no deja borrar la única tarifa vigente de una consulta", async () => {
    prisma.professionalRate.findFirst.mockResolvedValue({ serviceId: SVC, approvedPrice: 40000 });
    prisma.professionalRate.count.mockResolvedValue(0);

    const res = await deleteRate("general");

    expect(res.error).toMatch(/única tarifa vigente/);
    expect(prisma.professionalRate.deleteMany).not.toHaveBeenCalled();
  });

  it("permite borrar una tarifa si queda otra vigente para esa consulta", async () => {
    prisma.professionalRate.findFirst.mockResolvedValue({ serviceId: SVC, approvedPrice: 55000 });
    prisma.professionalRate.count.mockResolvedValue(1);
    prisma.professionalRate.deleteMany.mockResolvedValue({ count: 1 });

    const res = await deleteRate("domicilio");

    expect(res.success).toBe(true);
  });
});

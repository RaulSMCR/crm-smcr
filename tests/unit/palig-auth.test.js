import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), preview: vi.fn(), user: vi.fn(), responsible: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session, isPreviewSession: mocks.preview }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.user } } }));
vi.mock("@/lib/api-guards", () => ({ esEmisorResponsable: mocks.responsible }));
import { requirePaligOperator } from "@/lib/palig-auth";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ sub: "u1", role: "PROFESSIONAL", professionalProfileId: "untrusted-profile" });
  mocks.user.mockResolvedValue({ id: "u1", role: "PROFESSIONAL", isActive: true, professionalProfile: { id: "raul-id", slug: "raul-olmedo", isApproved: true } });
});

describe("acceso al piloto PALIG", () => {
  it("resuelve la cuenta de Raúl en la base sin confiar en el perfil del JWT", async () => {
    expect(await requirePaligOperator()).toMatchObject({ userId: "u1", professionalId: "raul-id", isAdmin: false });
  });
  it("conserva el acceso del administrador responsable de la emisión", async () => {
    mocks.session.mockResolvedValue({ sub: "u1", role: "ADMIN" });
    mocks.user.mockResolvedValue({ id: "u1", role: "ADMIN", isActive: true, email: "admin@example.com" });
    mocks.responsible.mockReturnValue(true);
    expect(await requirePaligOperator()).toMatchObject({ userId: "u1", isAdmin: true });
    mocks.responsible.mockReturnValue(false);
    expect((await requirePaligOperator()).error.status).toBe(403);
  });
  it.each([
    { id: "u1", role: "PROFESSIONAL", isActive: false, professionalProfile: { slug: "raul-olmedo", isApproved: true } },
    { id: "u1", role: "PROFESSIONAL", isActive: true, professionalProfile: { slug: "otro", isApproved: true } },
    { id: "u1", role: "PROFESSIONAL", isActive: true, professionalProfile: { slug: "raul-olmedo", isApproved: false } },
    { id: "u1", role: "USER", isActive: true },
  ])("rechaza cuentas fuera del piloto: %j", async (user) => {
    mocks.user.mockResolvedValue(user);
    expect((await requirePaligOperator()).error.status).toBe(403);
  });
  it("rechaza sesiones ausentes y de vista previa sin consultar datos de pacientes", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await requirePaligOperator()).error.status).toBe(401);
    mocks.session.mockResolvedValue({ role: "PROFESSIONAL", sub: "u1" });
    mocks.preview.mockReturnValue(true);
    expect((await requirePaligOperator()).error.status).toBe(403);
    expect(mocks.user).not.toHaveBeenCalled();
  });
});

import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ session: vi.fn(), claim: vi.fn(), signed: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: m.session }));
vi.mock("@/lib/prisma", () => ({ prisma: { insuranceClaim: { findUnique: m.claim } } }));
vi.mock("@/lib/storage", async (original) => ({ ...await original(), getSignedUrl: m.signed }));
import { GET } from "@/app/api/files/route";
beforeEach(() => { vi.resetAllMocks(); m.claim.mockResolvedValue({ patientId: "u1", professionalId: "p1" }); m.signed.mockResolvedValue("https://storage.example.com/signed"); });
const request = (path) => new Request(`http://localhost/api/files?path=${encodeURIComponent(path)}`);
it("el paciente recibe su formulario firmado, pero no respaldos ni borradores PALIG", async () => {
  m.session.mockResolvedValue({ sub: "u1", role: "USER" });
  expect((await GET(request("insurance-signed-forms/c1/palig/proof.png"))).status).toBe(403);
  expect(m.signed).not.toHaveBeenCalled();
  expect((await GET(request("insurance-signed-forms/c1/signed-form.pdf"))).status).toBe(302);
});
it("las copias del piloto exigen su ruta específica, incluso para profesionales y admin", async () => {
  for (const role of ["PROFESSIONAL", "ADMIN"]) {
    m.session.mockResolvedValue({ sub: "operator", role, professionalProfileId: "p1" });
    expect((await GET(request("insurance-signed-forms/c1/palig/form.pdf"))).status).toBe(403);
  }
  expect(m.signed).not.toHaveBeenCalled();
});

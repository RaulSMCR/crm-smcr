import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), drain: vi.fn(), jobs: vi.fn(), reset: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.session }));
vi.mock("@/lib/prisma", () => ({ prisma: { deliveryJob: { findMany: mocks.jobs, updateMany: mocks.reset } } }));
vi.mock("@/lib/payment-deliveries", () => ({ processPaymentDeliveries: mocks.drain }));
import { GET, POST } from "@/app/api/admin/payment-deliveries/route";
import { POST as worker } from "@/app/api/payments/deliveries/run/route";

const request = (origin = "https://example.invalid", body = {}) => new Request("https://example.invalid/api/admin/payment-deliveries", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => { vi.resetAllMocks(); mocks.session.mockResolvedValue({ role: "ADMIN", sub: "admin-local" }); mocks.drain.mockResolvedValue({ processed: 1 }); mocks.jobs.mockResolvedValue([]); });
afterEach(() => vi.unstubAllEnvs());
it.each([null, "USER", "PROFESSIONAL"])("niega lectura y ejecución al rol %s", async (role) => {
  mocks.session.mockResolvedValue(role ? { role } : null);
  expect((await GET()).status).toBe(role ? 403 : 401);
  expect((await POST(request())).status).toBe(role ? 403 : 401);
  expect(mocks.drain).not.toHaveBeenCalled(); expect(mocks.jobs).not.toHaveBeenCalled();
});
it("rechaza ejecución desde otro origen", async () => {
  expect((await POST(request("https://other.invalid"))).status).toBe(403);
  expect(mocks.drain).not.toHaveBeenCalled();
});
it("permite procesar al administrador del mismo origen", async () => {
  expect((await POST(request())).status).toBe(200); expect(mocks.drain).toHaveBeenCalledTimes(1);
});
it("un correo de resultado incierto no se desbloquea forzando una referencia", async () => {
  mocks.reset.mockResolvedValue({ count: 0 });
  expect((await POST(request(undefined, { retryJobId: "local" }))).status).toBe(409);
  expect(mocks.reset).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "REVIEW", OR: [{ kind: "FE_SUBMISSION" }, { firstSendAt: null }] }) }));
  expect(mocks.drain).not.toHaveBeenCalled();
});
it("el worker sin configuración de firma no ejecuta tareas", async () => {
  for (const key of ["QSTASH_CURRENT_SIGNING_KEY", "QSTASH_NEXT_SIGNING_KEY", "QSTASH_REGION"]) vi.stubEnv(key, "");
  expect((await worker(request())).status).toBe(503); expect(mocks.drain).not.toHaveBeenCalled();
});

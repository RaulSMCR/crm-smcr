import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), enqueue: vi.fn(), submit: vi.fn(), send: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  invoice: { findUnique: mocks.find, updateMany: mocks.update },
  deliveryJob: { upsert: mocks.enqueue }, $transaction: mocks.transaction,
} }));
vi.mock("@/lib/fe/client.js", () => ({ submitToHacienda: mocks.submit }));
vi.mock("@/lib/fe/config.js", () => ({ assertFeConfig: () => true, FE_EMISOR: { ambiente: "01" } }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send: mocks.send } } }));
const snapshot = { id: "invoice-local", status: "PAID", feStatus: "PENDING", feNumber: "123", feClave: "key", feXml: "XML_EXISTING", feRespuestaXml: null, lines: [] };
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.stubEnv("FE_API_URL", "https://hacienda.example.invalid");
  mocks.find.mockResolvedValue(snapshot); mocks.update.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (fn) => fn({ invoice: { updateMany: mocks.update, findUnique: mocks.find }, deliveryJob: { upsert: mocks.enqueue } }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
const run = async () => (await import("@/lib/fe/submit.js")).submitInvoiceToFe("invoice-local");

it("un fallo de comunicación conserva clave y XML, sin convertirlo en rechazo", async () => {
  mocks.submit.mockRejectedValue(new Error("PRIVATE_PROVIDER_TEXT"));
  expect(await run()).toMatchObject({ feStatus: "PENDING", feClave: "key", feNumber: "123" });
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: "invoice-local", feStatus: "PENDING" }, data: { feErrorMessage: expect.any(String) } });
  expect(JSON.stringify(console.error.mock.calls)).not.toContain("PRIVATE_PROVIDER_TEXT");
  expect(mocks.enqueue).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
});
it("una factura ya aceptada recupera únicamente su tarea de correo", async () => {
  mocks.find.mockResolvedValue({ ...snapshot, feStatus: "ACCEPTED" });
  expect((await run()).feStatus).toBe("ACCEPTED");
  expect(mocks.submit).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ kind: "FE_RECEIPT", invoiceId: "invoice-local" }) }));
});
it("la aceptación y la tarea de correo se guardan dentro de la misma transacción", async () => {
  mocks.submit.mockResolvedValue({ feStatus: "ACCEPTED", feNumber: "123", feClave: "key", respuestaXml: "RESPONSE", feErrorMessage: null });
  mocks.find.mockResolvedValueOnce(snapshot).mockResolvedValue({ ...snapshot, feStatus: "ACCEPTED" });
  let inTransaction = false;
  mocks.transaction.mockImplementation(async (fn) => { inTransaction = true; const result = await fn({ invoice: { updateMany: mocks.update, findUnique: mocks.find }, deliveryJob: { upsert: mocks.enqueue } }); inTransaction = false; return result; });
  mocks.enqueue.mockImplementation(async () => { expect(inTransaction).toBe(true); });
  expect((await run()).feStatus).toBe("ACCEPTED");
  expect(mocks.transaction).toHaveBeenCalledTimes(1); expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  expect(mocks.send).not.toHaveBeenCalled();
});
it("una falla al guardar la entrega no se oculta como éxito fiscal", async () => {
  mocks.submit.mockResolvedValue({ feStatus: "ACCEPTED", feNumber: "123", feClave: "key" });
  mocks.find.mockResolvedValueOnce(snapshot).mockResolvedValue({ ...snapshot, feStatus: "ACCEPTED" });
  mocks.enqueue.mockRejectedValue(new Error("QUEUE_WRITE_FAILED"));
  await expect(run()).rejects.toThrow("QUEUE_WRITE_FAILED");
});

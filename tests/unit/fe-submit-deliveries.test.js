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
it("nombra el motivo cuando es uno de nuestros codigos, para no adivinar la causa", async () => {
  // Distinguir una credencial de ATV equivocada de una caida de Hacienda era
  // imposible: el comprobante quedaba PENDING con un texto generico y el log no
  // traia el error. Estos codigos los lanzan lib/fe/client.js y lib/fe/auth.js.
  mocks.submit.mockRejectedValue(new Error("FE_AUTH_UNAVAILABLE"));
  const res = await run();
  expect(res.feStatus).toBe("PENDING");
  expect(mocks.update).toHaveBeenCalledWith({
    where: { id: "invoice-local", feStatus: "PENDING" },
    data: { feErrorMessage: expect.stringContaining("FE_AUTH_UNAVAILABLE") },
  });
  expect(JSON.stringify(console.error.mock.calls)).toContain("FE_AUTH_UNAVAILABLE");
});

it("guarda lo que Hacienda explica en X-Error-Cause, no solo el código", async () => {
  // El motivo real venía en un encabezado que nadie leía: la 0189 estuvo un mes
  // diciendo FE_STATUS_UNAVAILABLE mientras Hacienda contestaba, en cada
  // respuesta, que el comprobante no había sido recibido.
  const error = new Error("FE_STATUS_UNAVAILABLE");
  error.causaHacienda = "El comprobante [506...356] no ha sido recibido.";
  mocks.submit.mockRejectedValue(error);

  await run();

  const guardado = JSON.stringify(mocks.update.mock.calls);
  expect(guardado).toContain("FE_STATUS_UNAVAILABLE");
  expect(guardado).toContain("no ha sido recibido");
});

it("publica la causa de Hacienda aunque el código quede sin clasificar", async () => {
  // Son dos procedencias distintas: el `error.message` de nuestros módulos puede
  // arrastrar datos del comprobante y sigue sin publicarse; el encabezado de
  // Hacienda es un mensaje corto ya saneado y sí se publica.
  const error = new Error("Hacienda dice: <Receptor><Nombre>Ana</Nombre>");
  error.causaHacienda = "La numeracion consecutiva ya existe.";
  mocks.submit.mockRejectedValue(error);

  await run();

  const guardado = JSON.stringify(mocks.update.mock.calls);
  expect(guardado).toContain("FE_ERROR_NO_CLASIFICADO");
  expect(guardado).toContain("La numeracion consecutiva ya existe.");
  expect(guardado).not.toContain("Ana");
});

it("reduce a una marca cualquier motivo que no sea nuestro", async () => {
  mocks.submit.mockRejectedValue(new Error("Hacienda dice: <Receptor><Nombre>Ana</Nombre>"));
  await run();
  const guardado = JSON.stringify(mocks.update.mock.calls);
  expect(guardado).toContain("FE_ERROR_NO_CLASIFICADO");
  expect(guardado).not.toContain("Ana");
  expect(JSON.stringify(console.error.mock.calls)).not.toContain("Ana");
});

it("un envío que queda PENDING deja tarea para que alguien reconsulte", async () => {
  // La aceptación de Hacienda es asincrónica, así que PENDING es el resultado
  // normal de un envío. Sin tarea, nadie vuelve a preguntar: la 0203 quedó así
  // tras enviarse desde el panel, y el motivo del rechazo —que Hacienda sí
  // había mandado— solo apareció al consultar el estado a mano.
  mocks.submit.mockResolvedValue({ feStatus: "PENDING", feNumber: "00100001010000000203", feClave: "clave-203", feErrorMessage: "Pendiente de confirmación." });
  mocks.find.mockResolvedValue({ ...snapshot, feStatus: "PENDING", feClave: "clave-203", feXml: "XML" });

  await run();

  expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({
    where: { dedupeKey: "FE_SUBMISSION:invoice-local" },
  }));
  // Y no el correo: todavía no hay comprobante aceptado que entregar.
  const encolados = mocks.enqueue.mock.calls.map(([arg]) => arg.where.dedupeKey);
  expect(encolados).not.toContain("FE_RECEIPT:invoice-local");
});

it("sin clave no se encola reconsulta: no habría nada que preguntar", async () => {
  mocks.submit.mockResolvedValue({ feStatus: "PENDING", feNumber: null, feClave: null, feErrorMessage: null });
  mocks.find.mockResolvedValue({ ...snapshot, feStatus: "PENDING", feClave: null, feXml: null });

  await run();

  expect(mocks.enqueue).not.toHaveBeenCalled();
});

it("una clave rechazada no vuelve a contactar a Hacienda por ningún camino", async () => {
  // El veredicto es definitivo: reenviar o reconsultar devuelve el mismo
  // rechazo. Pasa por acá el botón «Enviar FE», la tarea de la cola y su
  // reintento manual, así que la regla vale para los tres.
  mocks.find.mockResolvedValue({
    ...snapshot, feStatus: "REJECTED", feClave: "clave-0203", feNumber: "00100001010000000203",
    feErrorMessage: "El certificado empleado se encuentra revocado.",
  });

  const res = await run();

  expect(mocks.submit).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.enqueue).not.toHaveBeenCalled();
  expect(res).toMatchObject({ feStatus: "REJECTED", feClave: "clave-0203", reviewRequired: true });
  expect(res.feErrorMessage).toContain("revocado");
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

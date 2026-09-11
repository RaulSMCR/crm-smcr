import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tx: vi.fn(), invoice: vi.fn(), send: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { paymentTransaction: { findUnique: mocks.tx }, invoice: { findUnique: mocks.invoice } } }));
vi.mock("@/lib/resend", () => ({ resend: { emails: { send: mocks.send } } }));
vi.mock("@/lib/fe/config", () => ({ FE_EMISOR: { ambiente: "01" } }));
vi.mock("@/lib/fe/submit", () => ({ submitInvoiceToFe: mocks.submit, sendFeEmail: (invoice, { deliver }) => deliver({ to: invoice.contact.email, html: "receipt" }) }));
vi.mock("@/lib/onvo/payment-mail", () => ({ sendPaymentConfirmationEmail: (tx, deliver) => deliver({ to: tx.patient.email, html: "confirmation" }) }));
import { executePaymentDelivery } from "@/lib/payment-deliveries";

const job = { id: "job-local", invoiceId: "invoice-local", paymentTransactionId: "tx-local", kind: "PAYMENT_CONFIRMATION" };
let checkpoint;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("RESEND_API_KEY", "local-test-only");
  checkpoint = { beforeSend: vi.fn(async () => {}) };
  mocks.tx.mockResolvedValue({ status: "APPROVED", type: "FULL_100", patient: { email: "local@example.invalid" }, appointment: { status: "CONFIRMED", paymentStatus: "PAID" } });
  mocks.send.mockResolvedValue({ data: { id: "mail-local" }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

it("persiste la huella antes del envío y usa la misma clave de Resend en cada reintento", async () => {
  mocks.send.mockImplementation(async () => { expect(checkpoint.beforeSend).toHaveBeenCalled(); return { data: { id: "same-mail" } }; });
  expect(await executePaymentDelivery(job, checkpoint)).toEqual({ providerId: "same-mail" });
  await executePaymentDelivery(job, checkpoint);
  expect(mocks.send.mock.calls[0][1]).toEqual({ idempotencyKey: "smcr-delivery/job-local" });
  expect(mocks.send.mock.calls[1][1]).toEqual(mocks.send.mock.calls[0][1]);
  expect(checkpoint.beforeSend.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
});
it("un error devuelto por Resend no cuenta como entrega exitosa", async () => {
  mocks.send.mockResolvedValue({ data: null, error: { name: "rate_limit_exceeded", message: "PRIVATE_TEST" } });
  await expect(executePaymentDelivery(job, checkpoint)).rejects.toMatchObject({ code: "MAIL_PROVIDER_FAILED", review: false });
});
it("sin configuración de correo conserva la tarea sin marcar un intento externo", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  await expect(executePaymentDelivery(job, checkpoint)).rejects.toMatchObject({ code: "MAIL_NOT_CONFIGURED" });
  expect(mocks.send).not.toHaveBeenCalled(); expect(checkpoint.beforeSend).not.toHaveBeenCalled();
});
it.each(["PENDING", "REJECTED"])("el estado fiscal %s no cierra la tarea como éxito", async (feStatus) => {
  mocks.submit.mockResolvedValue({ feStatus });
  await expect(executePaymentDelivery({ ...job, kind: "FE_SUBMISSION" }, checkpoint)).rejects.toBeTruthy();
});
it("una aceptación fiscal cierra únicamente la tarea fiscal", async () => {
  mocks.submit.mockResolvedValue({ feStatus: "ACCEPTED" });
  await expect(executePaymentDelivery({ ...job, kind: "FE_SUBMISSION" }, checkpoint)).resolves.toEqual({});
  expect(mocks.send).not.toHaveBeenCalled();
});
it("no envía confirmación de reserva si la cita fue cancelada antes de recuperar la tarea", async () => {
  mocks.tx.mockResolvedValue({ status: "APPROVED", type: "FULL_100", appointment: { status: "CANCELLED_BY_USER" } });
  await expect(executePaymentDelivery(job, checkpoint)).rejects.toMatchObject({ code: "APPOINTMENT_CHANGED", review: true });
  expect(mocks.send).not.toHaveBeenCalled();
});
it("una factura aceptada permite recuperar su correo sin emitirla otra vez", async () => {
  mocks.invoice.mockResolvedValue({ feStatus: "ACCEPTED", status: "PAID", feXml: "fixture-xml", feNumber: "123", contact: { email: "local@example.invalid" } });
  await executePaymentDelivery({ ...job, kind: "FE_RECEIPT" }, checkpoint);
  expect(mocks.send).toHaveBeenCalledTimes(1); expect(mocks.submit).not.toHaveBeenCalled();
});
it("no entrega un comprobante rechazado en producción", async () => {
  mocks.invoice.mockResolvedValue({ feStatus: "REJECTED", status: "PAID", feXml: "fixture-xml", feNumber: "123" });
  await expect(executePaymentDelivery({ ...job, kind: "FE_RECEIPT" }, checkpoint)).rejects.toMatchObject({ review: true });
  expect(mocks.send).not.toHaveBeenCalled();
});

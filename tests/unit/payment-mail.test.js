import { expect, it, vi } from "vitest";
import { sendPaymentConfirmationEmail } from "@/lib/onvo/payment-mail";

const tx = (type, paymentStatus = "PAID") => ({
  type, amount: 20000, currency: "CRC", patient: { name: '<img src="x">', email: "local@example.invalid" },
  professional: { user: { name: "Profesional" } }, appointment: { paymentStatus, pricePaid: 40000, service: { title: "Consulta" } },
});
it("un adelanto tardío no anuncia otro saldo y escapa los datos interpolados", async () => {
  const deliver = vi.fn();
  await sendPaymentConfirmationEmail(tx("DEPOSIT_50"), deliver);
  const message = deliver.mock.calls[0][0];
  expect(message.html).toContain("pagada por completo");
  expect(message.html).not.toContain("un segundo enlace");
  expect(message.html).not.toContain("<img");
});
it("un cargo de cancelación no anuncia una cita reservada", async () => {
  const deliver = vi.fn();
  await sendPaymentConfirmationEmail(tx("PENALTY_50"), deliver);
  const message = deliver.mock.calls[0][0];
  expect(message.subject).toContain("Pago recibido");
  expect(message.html).toContain("cargo por cancelación tardía");
  expect(message.html).not.toContain("cita queda reservada");
});

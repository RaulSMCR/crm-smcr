import { resend } from "@/lib/resend";
import { escapePaymentAlertValue, logOnvoWebhook } from "@/lib/onvo/observability";

const FROM_EMAIL = process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>";

/**
 * Alerta de incidencias autenticadas, con referencias para consultar el panel.
 * No incluye la identidad del pagador y escapa los valores interpolados.
 */
export async function sendAdminPaymentAlert({ subject, reason, eventId, onvoLinkId, amount, currency, paymentRecorded = false }) {
  const to = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
  if (!to || !process.env.RESEND_API_KEY) {
    logOnvoWebhook("error", "ADMIN_ALERT_UNAVAILABLE", { eventId });
    return;
  }

  const safe = escapePaymentAlertValue;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#b91c1c;">Pago ONVO requiere revisión</h2>
      <p>${paymentRecorded ? "El pago y la factura se registraron. Revise la configuración fiscal del servicio." : "Un webhook de ONVO no pudo conciliarse automáticamente. No se acreditó el pago a ninguna cita."}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
        <tr><td style="padding:6px 8px;color:#64748b;width:180px;">Motivo</td><td style="padding:6px 8px;font-weight:600;">${safe(reason)}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Evento ONVO</td><td style="padding:6px 8px;">${safe(eventId)}</td></tr>
        <tr><td style="padding:6px 8px;color:#64748b;">Enlace de pago</td><td style="padding:6px 8px;">${safe(onvoLinkId)}</td></tr>
        <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Monto</td><td style="padding:6px 8px;">${safe(amount)} ${safe(currency)}</td></tr>
      </table>
      <p style="font-size:13px;color:#475569;">Revise las referencias en el panel de conciliación y compruebe el registro en ONVO antes de actuar.</p>
      <p style="font-size:12px;color:#94a3b8;margin-top:24px;">Alerta automática del sistema de pagos de Salud Mental Costa Rica.</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
  if (error) logOnvoWebhook("error", "ADMIN_ALERT_FAILED", { eventId, error });
}

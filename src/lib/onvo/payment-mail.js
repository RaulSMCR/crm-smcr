import { paymentTypeLabel } from "@/lib/detalle-consulta";
import { detalleLugarCita, lugarCitaEnUnaLinea } from "@/lib/lugar-cita";
import { SITE_URL } from "@/lib/site-url";
import { escapePaymentAlertValue as safe } from "@/lib/onvo/observability";

const FROM_EMAIL = process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>";

export async function sendPaymentConfirmationEmail(transaction, deliver) {
  const patientEmail = transaction.patient?.email;
  const patientName  = transaction.patient?.name || "Paciente";
  const proName      = transaction.professional?.user?.name || "el profesional";
  const amount       = Number(transaction.amount).toLocaleString("es-CR");
  const currency     = transaction.currency || "CRC";
  const paymentLabel = paymentTypeLabel(transaction.type);

  if (!patientEmail) throw new Error("PAYMENT_RECIPIENT_MISSING");

  const cita = transaction.appointment;
  const cuando = cita?.date
    ? new Intl.DateTimeFormat("es-CR", {
        timeZone: "America/Costa_Rica",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(cita.date))
    : null;

  // El correo que confirma el pago es el que la gente guarda: acá va la
  // dirección completa, cómo llegar, y —si es virtual— cuándo llega el enlace.
  const lugar = lugarCitaEnUnaLinea(cita) || null;
  const avisoLugar = detalleLugarCita(cita).aviso;

  const total = cita?.pricePaid ? Number(cita.pricePaid).toLocaleString("es-CR") : null;
  const saldo =
    cita?.pricePaid && transaction.type === "DEPOSIT_50"
      ? (Number(cita.pricePaid) - Number(transaction.amount)).toLocaleString("es-CR")
      : null;

  // Qué le queda por delante al paciente. Es la parte que de verdad necesita:
  // saber si ya terminó de pagar o si le espera otro cobro, y cuándo.
  const reglas =
    transaction.type === "PENALTY_50"
      ? `<p style="margin:0;">Se registró el pago del cargo por cancelación tardía.</p>`
      : transaction.type === "DEPOSIT_50" && cita?.paymentStatus !== "PAID"
      ? `<p style="margin:0;">Con este adelanto <strong>tu cita queda reservada</strong>. El saldo
           de <strong>${currency} ${saldo || "—"}</strong> se cobra <strong>al concluir la
           consulta</strong>: vas a recibir entonces un segundo enlace de pago por correo.</p>
         <p style="margin:12px 0 0;">Se cobra la mitad por adelantado solo en la primera cita con
           cada profesional. En las siguientes se cobra el total al terminar la consulta.</p>`
      : transaction.type === "BALANCE_50"
        ? `<p style="margin:0;">Con este pago <strong>la cita queda saldada</strong>. No hay
             cobros pendientes.</p>`
        : `<p style="margin:0;">La cita queda <strong>pagada por completo</strong>. No hay cobros
             pendientes.</p>`;

  const filas = [
    ["Profesional", proName],
    ["Servicio", cita?.service?.title],
    ["Fecha y hora", cuando],
    ["Lugar", lugar],
    ["Precio de la consulta", total ? `${currency} ${total}` : null],
  ]
    .filter(([, valor]) => valor)
    .map(
      ([etiqueta, valor], i) => `
        <tr${i % 2 ? ' style="background:#f8fafc;"' : ""}>
          <td style="padding:6px 8px;color:#64748b;width:170px;">${etiqueta}</td>
          <td style="padding:6px 8px;font-weight:600;">${safe(valor)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#047857;">Pago recibido</h2>
      <p>Hola <strong>${safe(patientName)}</strong>, recibimos tu ${safe(paymentLabel)} de
         <strong>${safe(currency)} ${safe(amount)}</strong>.</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">${filas}</table>
      ${avisoLugar ? `<p style="margin:-6px 0 16px;font-size:13px;color:#475569;">${avisoLugar}</p>` : ""}

      <div style="padding:14px;border:1px solid #a7f3d0;border-radius:8px;background:#ecfdf5;
                  font-size:14px;color:#065f46;">
        ${reglas}
      </div>

      <p style="margin-top:16px;font-size:13px;color:#475569;">
        Tu factura electrónica llega en un correo aparte, con el comprobante adjunto.
      </p>
      <p style="margin-top:16px;font-size:13px;color:#475569;">
        ¿Necesitás mover la cita? Podés hacerlo desde tu panel avisando con al menos 24 horas.
        Las condiciones completas están en
        <a href="${SITE_URL}/terminos">términos y condiciones</a>.
      </p>
      <p style="font-size:12px;color:#94a3b8;margin-top:24px;">
        Este correo fue generado automáticamente por Salud Mental Costa Rica.
      </p>
    </div>`;

  return deliver({
    from: FROM_EMAIL,
    to: patientEmail,
    subject: `Pago recibido — ${paymentLabel} confirmado`,
    html,
  });

}

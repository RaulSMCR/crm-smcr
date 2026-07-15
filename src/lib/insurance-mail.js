// src/lib/insurance-mail.js
import { resend } from "@/lib/resend";

const FROM = process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

function fileUrl(value) {
  const raw = String(value || "");
  if (raw.startsWith("/") || raw.startsWith("http")) return raw;
  return `${APP_URL}/api/files?path=${encodeURIComponent(raw)}`;
}

// ── 1. Admin: paciente marcó seguro ─────────────────────────────────────────
export async function sendInsuranceAdminAlert({ adminEmails, patientName, insuranceName }) {
  if (!adminEmails?.length || !process.env.RESEND_API_KEY) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1e40af;">Paciente con seguro médico — acción requerida</h2>
      <p>El paciente <strong>${patientName}</strong> ha indicado que tiene seguro médico
         <strong>(${insuranceName || "no especificado"})</strong> y planea usarlo para
         el pago de sus consultas.</p>
      <p>Por favor suba el formulario de reclamo en blanco correspondiente a su perfil.</p>
      <p style="margin-top:24px;">
        <a href="${APP_URL}/panel/admin/seguros"
           style="background:#1d4ed8;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Gestionar seguros
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:24px;">Mensaje automático — Salud Mental Costa Rica</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: adminEmails,
    subject: `Seguro médico — ${patientName} requiere formulario de reclamo`,
    html,
  });

  if (error) console.error("[insurance-mail] sendInsuranceAdminAlert error:", error);
}

// ── 2. Paciente: admin subió formulario en blanco ────────────────────────────
export async function sendInsurancePatientFormAlert({ patientEmail, patientName, blankFormUrl }) {
  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1e40af;">Su formulario de reclamo de seguro está listo</h2>
      <p>Estimado/a <strong>${patientName}</strong>,</p>
      <p>El formulario de reclamo de su seguro médico ya está disponible. Para continuar con
         el proceso, necesitamos que complete <strong>su parte del formulario</strong>
         (datos del asegurado: nombre, cédula, número de póliza, etc.).</p>
      <p><strong>Pasos a seguir:</strong></p>
      <ol style="line-height:1.8;">
        <li>Descargá el formulario en blanco usando el botón de abajo</li>
        <li>Complete únicamente las secciones correspondientes al asegurado</li>
        <li>Súbalo de regreso en su panel de paciente</li>
      </ol>
      <p style="margin-top:20px;">
        <a href="${blankFormUrl}"
           style="background:#1d4ed8;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">
          Descargar formulario
        </a>
        <a href="${APP_URL}/panel/paciente"
           style="background:#0f172a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Ir a mi panel
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:24px;">Mensaje automático — Salud Mental Costa Rica</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: patientEmail,
    subject: "Formulario de seguro disponible — complete su parte",
    html,
  });

  if (error) console.error("[insurance-mail] sendInsurancePatientFormAlert error:", error);
}

// ── 3. Profesional: paciente subió su parte del formulario ───────────────────
export async function sendInsuranceProTemplateAlert({ proEmail, patientName, patientFormUrl }) {
  if (!proEmail || !process.env.RESEND_API_KEY) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1e40af;">Formulario de seguro pendiente de completar</h2>
      <p>El/La paciente <strong>${patientName}</strong> ha completado su parte del
         formulario de reclamo de seguro médico.</p>
      <p>Por favor descargue el formulario, complete las secciones correspondientes al
         profesional (diagnóstico, tratamiento, etc.) <strong>sin incluir la fecha de atención</strong>,
         y súbalo de regreso como plantilla desde su panel.</p>
      <p><strong>Pasos a seguir:</strong></p>
      <ol style="line-height:1.8;">
        <li>Descargá el formulario con los datos del paciente</li>
        <li>Complete las secciones del profesional — <em>deje la fecha en blanco</em></li>
        <li>Súbalo en su panel como "plantilla" en la sección Seguros</li>
      </ol>
      <p style="margin-top:20px;">
        <a href="${patientFormUrl}"
           style="background:#1d4ed8;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">
          Descargar formulario del paciente
        </a>
        <a href="${APP_URL}/panel/profesional/citas"
           style="background:#0f172a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Ir a mi panel
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:24px;">Mensaje automático — Salud Mental Costa Rica</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: proEmail,
    subject: `Formulario de seguro de ${patientName} — complete sección profesional`,
    html,
  });

  if (error) console.error("[insurance-mail] sendInsuranceProTemplateAlert error:", error);
}

// ── 4. Profesional: pago recibido — añadir fecha, sellar, firmar y subir ─────
export async function sendInsuranceProSignAlert({
  proEmail,
  patientName,
  insuranceName,
  paymentDate,
  templateUrl,
}) {
  if (!proEmail || !process.env.RESEND_API_KEY) return;

  const dateStr = paymentDate
    ? new Date(paymentDate).toLocaleDateString("es-CR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  const downloadSection = templateUrl
    ? `<p style="margin-top:20px;">
        <a href="${fileUrl(templateUrl)}"
           style="background:#1d4ed8;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;margin-right:12px;">
          Descargar plantilla
        </a>
        <a href="${APP_URL}/panel/profesional/citas"
           style="background:#0f172a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Subir planilla firmada
        </a>
      </p>`
    : `<p style="color:#dc2626;"><strong>Nota:</strong> La plantilla aún no está disponible.
       Por favor acceda a su panel para completarla antes de continuar.</p>
       <p><a href="${APP_URL}/panel/profesional/citas" style="background:#0f172a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;">
       Ir a mi panel</a></p>`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1e40af;">Planilla de seguro lista — pago recibido</h2>
      <p>Se ha recibido el pago de <strong>${patientName}</strong>
         (seguro: <strong>${insuranceName || "no especificado"}</strong>).</p>
      <table style="border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden;width:100%;">
        <tr>
          <td style="padding:10px 16px;font-weight:bold;color:#475569;">Paciente</td>
          <td style="padding:10px 16px;">${patientName}</td>
        </tr>
        <tr style="background:#f1f5f9;">
          <td style="padding:10px 16px;font-weight:bold;color:#475569;">Fecha del pago</td>
          <td style="padding:10px 16px;color:#1d4ed8;font-weight:bold;">${dateStr}</td>
        </tr>
      </table>
      <p><strong>Pasos a seguir:</strong></p>
      <ol style="line-height:1.8;">
        <li>Descargá la plantilla del formulario</li>
        <li>Escriba la fecha de atención: <strong>${dateStr}</strong></li>
        <li>Imprima, selle y firme el formulario</li>
        <li>Escanee y suba el formulario completo desde su panel</li>
      </ol>
      ${downloadSection}
      <p style="font-size:12px;color:#64748b;margin-top:24px;">Mensaje automático — Salud Mental Costa Rica</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: proEmail,
    subject: `Planilla de seguro ${patientName} — fecha: ${dateStr}`,
    html,
  });

  if (error) console.error("[insurance-mail] sendInsuranceProSignAlert error:", error);
}

// ── 5. Paciente: formulario firmado enviado ──────────────────────────────────
export async function sendSignedClaimToPatient({ patientEmail, patientName, signedFormUrl }) {
  if (!patientEmail || !process.env.RESEND_API_KEY) return;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1e40af;">Su planilla de reclamo de seguro médico</h2>
      <p>Estimado/a <strong>${patientName}</strong>,</p>
      <p>Adjunto encontrará su planilla de reclamo de seguro médico debidamente completada,
         sellada y firmada por el profesional tratante.</p>
      <p>Podés descargarla y presentarla ante tu aseguradora para solicitar el reembolso.</p>
      <p style="margin-top:24px;">
        <a href="${signedFormUrl}"
           style="background:#1d4ed8;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">
          Descargar planilla de reclamo
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;margin-top:24px;">
        Si tiene alguna consulta, no dude en contactarnos.<br>
        Mensaje automático — Salud Mental Costa Rica
      </p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: patientEmail,
    subject: "Su planilla de reclamo de seguro médico — Salud Mental Costa Rica",
    html,
  });

  if (error) console.error("[insurance-mail] sendSignedClaimToPatient error:", error);
}

// src/lib/payment-alerts.js
// Aviso al administrador cuando una cita queda agendada sin su orden de cobro.
//
// Vivía dentro de patient-booking-actions.js, que es el flujo del panel. El
// flujo público (/agendar/[id] -> booking-actions.js) es el que usan los
// pacientes de verdad y no lo tenía: una cita podía quedar sin cobro con el
// fallo apenas escrito en la consola de Vercel. Pasó en producción y nadie se
// enteró hasta revisar los logs a mano.

/**
 * Avisa al administrador que una cita quedó agendada sin su orden de cobro.
 *
 * Se manda por separado del flujo de la cita para que un fallo del correo no
 * tumbe la reserva: el horario ya está tomado y perderlo sería peor. Por eso
 * nunca lanza; el llamador no tiene que protegerse.
 *
 * @param {object} appointment Cita ya hidratada (patient y professional.user).
 * @param {{code?: string, error?: string}} resultado Lo que devolvió el cobro.
 */
export async function alertarCobroNoGenerado(appointment, resultado = {}) {
  try {
    const to = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
    if (!to || !process.env.RESEND_API_KEY || !appointment) return;

    const { resend } = await import("@/lib/resend");
    const cuando = new Intl.DateTimeFormat("es-CR", {
      timeZone: "America/Costa_Rica",
      dateStyle: "full",
      timeStyle: "short",
    }).format(appointment.date);

    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>",
      to,
      subject: "⚠ Cita agendada sin orden de cobro",
      html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
        <h2 style="color:#b91c1c;">Cita sin enlace de pago</h2>
        <p>Se agendó una cita pero <strong>no se pudo generar el cobro</strong>. El paciente
           no recibió enlace de pago y la cita quedó reservada igual.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
          <tr><td style="padding:6px 8px;color:#64748b;width:150px;">Paciente</td>
              <td style="padding:6px 8px;">${appointment.patient?.name || "—"} &lt;${appointment.patient?.email || "—"}&gt;</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Profesional</td>
              <td style="padding:6px 8px;">${appointment.professional?.user?.name || "—"}</td></tr>
          <tr><td style="padding:6px 8px;color:#64748b;">Cita</td>
              <td style="padding:6px 8px;">${cuando}</td></tr>
          <tr style="background:#f8fafc;"><td style="padding:6px 8px;color:#64748b;">Motivo</td>
              <td style="padding:6px 8px;font-weight:600;">${resultado.code || ""} ${resultado.error || ""}</td></tr>
        </table>
        <p style="font-size:13px;color:#475569;">Acción: generar el cobro a mano desde el panel,
           o corregir la configuración y reintentar.</p>
      </div>`,
    });
  } catch (error) {
    console.error("[payment] No se pudo avisar del cobro fallido:", error);
  }
}

// src/app/api/contact-faq/route.js
import { NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ── Configuración de destino ──────────────────────────────────────────────────
//
//  Añadí esta variable en tu .env.local para recibir los mensajes en tu correo:
//
//    CONTACT_FAQ_RECIPIENT=raul.olmedo@gmail.com
//
//  Sin ella, los emails llegarán a la dirección configurada en EMAIL_FROM.
//  No es necesario modificar este archivo para cambiar el destinatario.
//
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_SUBJECTS = {
  tech:          "Problema técnico con mi cuenta",
  registro:      "Duda sobre el registro",
  institucional: "Asunto institucional / Profesionales",
};

// RFC 5322 simplified — cubre el 99.9 % de los correos reales
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Elimina etiquetas HTML y recorta la longitud. */
function sanitize(value, maxLen = 2000) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")   // quita etiquetas HTML completas
    .replace(/[<>]/g, "")      // elimina ángulos sueltos
    .trim()
    .slice(0, maxLen);
}

/** Escapa caracteres especiales HTML para incrustar en plantillas. */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request) {
  try {
    // ── 1. Validar Content-Type ───────────────────────────────────────────────
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type debe ser application/json" }, 415);
    }

    // ── 2. Parsear body ───────────────────────────────────────────────────────
    const body = await request.json().catch(() => ({}));

    // ── 3. Sanitizar ──────────────────────────────────────────────────────────
    const nombre  = sanitize(body?.nombre,  100);
    const email   = String(body?.email  ?? "").trim().toLowerCase().slice(0, 254);
    const asunto  = String(body?.asunto ?? "").trim();
    const mensaje = sanitize(body?.mensaje, 2000);

    // ── 4. Validar ────────────────────────────────────────────────────────────
    if (!nombre)
      return json({ error: "El nombre es requerido." }, 400);

    if (!email || !EMAIL_RE.test(email))
      return json({ error: "El correo electrónico no tiene un formato válido." }, 400);

    if (!ALLOWED_SUBJECTS[asunto])
      return json({ error: "El asunto seleccionado no es válido." }, 400);

    if (mensaje.length < 10)
      return json({ error: "El mensaje es demasiado corto (mínimo 10 caracteres)." }, 400);

    // ── 5. Verificar Cloudflare Turnstile ─────────────────────────────────────
    const captchaToken = String(body?.captchaToken ?? "").trim();

    if (!captchaToken)
      return json({ error: "La verificación de seguridad es requerida." }, 400);

    if (process.env.TURNSTILE_SECRET_KEY) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";

      const tsRes  = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method:  "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body:    new URLSearchParams({
            secret:   process.env.TURNSTILE_SECRET_KEY,
            response: captchaToken,
            ...(ip ? { remoteip: ip } : {}),
          }),
        },
      );
      const tsData = await tsRes.json().catch(() => ({ success: false }));

      if (!tsData.success) {
        console.warn("contact-faq turnstile rejected:", tsData["error-codes"]);
        return json(
          { error: "La verificación de seguridad falló. Recargá la página e intentá de nuevo." },
          403,
        );
      }
    } else {
      // En desarrollo sin clave configurada se omite la verificación
      console.warn("[contact-faq] TURNSTILE_SECRET_KEY no configurada — verificación omitida.");
    }

    // ── 6. Persistir como Lead (best-effort: si falla, el email igual sale) ────
    try {
      await prisma.lead.create({
        data: {
          name: nombre,
          email,
          subject: ALLOWED_SUBJECTS[asunto],
          message: mensaje,
          channel: "FAQ_FORM",
          utmSource: sanitize(body?.utmSource, 120) || null,
          utmMedium: sanitize(body?.utmMedium, 120) || null,
          utmCampaign: sanitize(body?.utmCampaign, 160) || null,
          utmTerm: sanitize(body?.utmTerm, 160) || null,
          utmContent: sanitize(body?.utmContent, 160) || null,
          referrer: sanitize(body?.referrer, 200) || null,
          landingPath: sanitize(body?.landingPath, 500) || null,
        },
      });
    } catch (leadError) {
      console.error("[contact-faq] no se pudo guardar el lead:", leadError);
    }

    // ── 7. Simular envío si no hay API key de Resend (desarrollo local) ───────
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_dummy_key") {
      console.log("[contact-faq] RESEND_API_KEY no configurada — envío simulado:", {
        nombre,
        email,
        asunto: ALLOWED_SUBJECTS[asunto],
        mensaje,
      });
      return json({
        ok: true,
        message: "Tu mensaje fue enviado con éxito. Te responderemos a la brevedad.",
      });
    }

    // ── 8. Enviar email vía Resend ────────────────────────────────────────────
    const recipient   = process.env.CONTACT_FAQ_RECIPIENT
                     || process.env.EMAIL_FROM
                     || "no-reply@saludmentalcostarica.com";

    const fromAddress = process.env.NOTIFICATIONS_FROM_EMAIL
                     || "no-reply@saludmentalcostarica.com";

    const mensajeHtml = escapeHtml(mensaje).replace(/\n/g, "<br>");

    const result = await resend.emails.send({
      from:    `Salud Mental CR <${fromAddress}>`,
      to:      recipient,
      replyTo: email,
      subject: `[Consulta FAQ] ${ALLOWED_SUBJECTS[asunto]}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#2f3133;max-width:600px">
          <h2 style="margin-bottom:4px;color:#2b7073">Nueva consulta desde la página de FAQ</h2>
          <p style="margin-top:0;font-size:13px;color:#5c5f61">Plataforma · Salud Mental CR</p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
            <tr>
              <td style="padding:9px 12px;background:#e9f4f4;font-weight:600;width:110px;vertical-align:top">Nombre</td>
              <td style="padding:9px 12px;border-bottom:1px solid #ece8e4">${escapeHtml(nombre)}</td>
            </tr>
            <tr>
              <td style="padding:9px 12px;background:#e9f4f4;font-weight:600;vertical-align:top">Correo</td>
              <td style="padding:9px 12px;border-bottom:1px solid #ece8e4">${escapeHtml(email)}</td>
            </tr>
            <tr>
              <td style="padding:9px 12px;background:#e9f4f4;font-weight:600;vertical-align:top">Asunto</td>
              <td style="padding:9px 12px;border-bottom:1px solid #ece8e4">${escapeHtml(ALLOWED_SUBJECTS[asunto])}</td>
            </tr>
          </table>

          <div style="background:#f5f6f2;border-left:3px solid #2b7073;padding:14px 18px;border-radius:0 6px 6px 0;font-size:14px">
            <p style="margin:0 0 10px;font-weight:600;color:#2b7073">Mensaje</p>
            <p style="margin:0;color:#2f3133">${mensajeHtml}</p>
          </div>

          <p style="margin-top:24px;font-size:12px;color:#9a9d9f">
            Para responder, usá el botón <strong>Responder</strong> de tu cliente de correo:
            el campo <em>Reply-To</em> está configurado con la dirección del remitente.
          </p>
        </div>
      `,
    });

    if (result?.error) {
      console.error("contact-faq resend error:", result.error);
      return json(
        { error: "No se pudo enviar el mensaje en este momento. Intentá de nuevo más tarde." },
        502,
      );
    }

    return json({
      ok: true,
      message: "Tu mensaje fue enviado con éxito. Te responderemos a la brevedad.",
    });

  } catch (error) {
    console.error("contact-faq error:", error);
    return json({ error: "Error interno del servidor." }, 500);
  }
}

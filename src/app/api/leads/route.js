// src/app/api/leads/route.js
// Recibe leads de los formularios públicos (contacto). Persiste SIEMPRE en DB
// (la fuente de verdad es la tabla Lead) y avisa al admin por email como
// best-effort: si Resend falla, el lead no se pierde.
import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { leadSchema, firstIssueMessage } from "@/lib/lead-schemas";
import { sendMetaEvent, utmCustomData } from "@/lib/meta-capi";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Elimina etiquetas HTML y recorta la longitud (patrón contact-faq). */
function sanitize(value, maxLen = 4000) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function getClientIp(request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Aviso al admin. Best-effort: nunca lanza. */
async function notifyAdmin(lead) {
  try {
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_dummy_key") {
      console.log("[leads] RESEND_API_KEY no configurada — aviso simulado:", {
        name: lead.name,
        email: lead.email,
        channel: lead.channel,
      });
      return;
    }

    const recipient =
      process.env.CONTACT_FAQ_RECIPIENT ||
      process.env.EMAIL_FROM ||
      "no-reply@saludmentalcostarica.com";
    const fromAddress =
      process.env.NOTIFICATIONS_FROM_EMAIL || "no-reply@saludmentalcostarica.com";

    const source = lead.utmSource || (lead.referrer ? `Referido: ${lead.referrer}` : "Directo");
    const campaign = lead.utmCampaign || "—";
    const mensajeHtml = escapeHtml(lead.message).replace(/\n/g, "<br>");

    const result = await resend.emails.send({
      from: `Salud Mental CR <${fromAddress}>`,
      to: recipient,
      replyTo: lead.email,
      subject: `[Nuevo lead] ${lead.name}${lead.utmCampaign ? ` · ${lead.utmCampaign}` : ""}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#2f3133;max-width:600px">
          <h2 style="margin-bottom:4px;color:#2b7073">Nuevo lead desde el formulario de contacto</h2>
          <p style="margin-top:0;font-size:13px;color:#5c5f61">Ya quedó guardado en el panel: Panel → Leads</p>

          <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
            <tr><td style="padding:9px 12px;background:#e9f4f4;font-weight:600;width:110px">Nombre</td><td style="padding:9px 12px;border-bottom:1px solid #ece8e4">${escapeHtml(lead.name)}</td></tr>
            <tr><td style="padding:9px 12px;background:#e9f4f4;font-weight:600">Correo</td><td style="padding:9px 12px;border-bottom:1px solid #ece8e4">${escapeHtml(lead.email)}</td></tr>
            ${lead.phone ? `<tr><td style="padding:9px 12px;background:#e9f4f4;font-weight:600">Teléfono</td><td style="padding:9px 12px;border-bottom:1px solid #ece8e4">${escapeHtml(lead.phone)}</td></tr>` : ""}
            <tr><td style="padding:9px 12px;background:#e9f4f4;font-weight:600">Origen</td><td style="padding:9px 12px;border-bottom:1px solid #ece8e4">${escapeHtml(source)} · Campaña: ${escapeHtml(campaign)}</td></tr>
          </table>

          <div style="background:#f5f6f2;border-left:3px solid #2b7073;padding:14px 18px;border-radius:0 6px 6px 0;font-size:14px">
            <p style="margin:0 0 10px;font-weight:600;color:#2b7073">Mensaje</p>
            <p style="margin:0;color:#2f3133">${mensajeHtml}</p>
          </div>

          <p style="margin-top:24px;font-size:12px;color:#9a9d9f">
            Respondé este correo directamente: el <em>Reply-To</em> apunta al lead.
          </p>
        </div>
      `,
    });

    if (result?.error) console.error("[leads] resend error:", result.error);
  } catch (error) {
    console.error("[leads] error enviando aviso:", error);
  }
}

export async function POST(request) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json({ error: "Content-Type debe ser application/json" }, 415);
    }

    const body = await request.json().catch(() => ({}));

    // Rate limit por IP antes de cualquier trabajo (5/h, igual que registro)
    const ip = getClientIp(request);
    const rl = await checkRateLimit(`lead:${ip}`, { max: 5, windowMinutes: 60 });
    if (rl.limited) {
      return json({ error: "Demasiados envíos. Esperá unos minutos e intentá de nuevo." }, 429);
    }

    // Sanitizar antes de validar (strip HTML)
    const parsed = leadSchema.safeParse({
      name: sanitize(body?.name, 120),
      email: String(body?.email ?? "").trim().toLowerCase().slice(0, 254),
      phone: sanitize(body?.phone, 32) || undefined,
      subject: sanitize(body?.subject, 160) || undefined,
      message: sanitize(body?.message, 4000),
      channel: body?.channel === "FAQ_FORM" ? "FAQ_FORM" : "CONTACT_FORM",
      utmSource: sanitize(body?.utmSource, 120) || undefined,
      utmMedium: sanitize(body?.utmMedium, 120) || undefined,
      utmCampaign: sanitize(body?.utmCampaign, 160) || undefined,
      utmTerm: sanitize(body?.utmTerm, 160) || undefined,
      utmContent: sanitize(body?.utmContent, 160) || undefined,
      referrer: sanitize(body?.referrer, 200) || undefined,
      landingPath: sanitize(body?.landingPath, 500) || undefined,
    });

    if (!parsed.success) {
      return json({ error: firstIssueMessage(parsed.error) }, 400);
    }

    // Captcha: solo se exige cuando hay secret configurada (patrón verifyTurnstile)
    if (process.env.TURNSTILE_SECRET_KEY) {
      const captchaOk = await verifyTurnstile(String(body?.captchaToken ?? ""), ip);
      if (!captchaOk) {
        return json(
          { error: "La verificación de seguridad falló. Recargá la página e intentá de nuevo." },
          403,
        );
      }
    }

    const data = parsed.data;
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        subject: data.subject || null,
        message: data.message,
        channel: data.channel,
        utmSource: data.utmSource || null,
        utmMedium: data.utmMedium || null,
        utmCampaign: data.utmCampaign || null,
        utmTerm: data.utmTerm || null,
        utmContent: data.utmContent || null,
        referrer: data.referrer || null,
        landingPath: data.landingPath || null,
      },
    });

    await notifyAdmin(lead);

    // Evento Lead a Meta CAPI. Fire-and-forget (no bloquea la respuesta) y
    // dedup determinístico por lead.id para el futuro píxel del cliente.
    // Solo se envían email/teléfono hasheados + UTMs (nada del mensaje).
    after(() =>
      sendMetaEvent({
        eventName: "Lead",
        eventId: `lead:${lead.id}`,
        userData: {
          email: lead.email,
          phone: lead.phone,
          clientIpAddress: ip,
          clientUserAgent: request.headers.get("user-agent") || undefined,
        },
        customData: utmCustomData(lead),
      }),
    );

    return json({
      ok: true,
      message: "Recibimos tu mensaje. Te responderemos a la brevedad.",
    });
  } catch (error) {
    console.error("[leads] error:", error);
    return json({ error: "Error interno del servidor." }, 500);
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const RESET_TOKEN_TTL_HOURS = 1;
const RESET_COOLDOWN_MIN = 2;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000";

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function sumarHoras(date, horas) {
  return new Date(date.getTime() + horas * 60 * 60 * 1000);
}
function sumarMinutos(date, mins) {
  return new Date(date.getTime() + mins * 60 * 1000);
}
function escaparHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(req) {
  try {
    const { email } = await req.json();

    // Respuesta genérica si falta (anti-enumeración)
    if (!email) return NextResponse.json({ ok: true });

    const emailNormalizado = String(email).trim().toLowerCase();
    const ahora = new Date();

    const prof = await prisma.professional.findUnique({
      where: { email: emailNormalizado },
      select: { id: true, name: true, resetLastSentAt: true },
    });

    const user = !prof
      ? await prisma.user.findUnique({
          where: { email: emailNormalizado },
          select: { id: true, name: true, resetLastSentAt: true },
        })
      : null;

    const entity = prof ? "PROFESSIONAL" : user ? "USER" : null;
    const record = prof || user;

    if (!record) return NextResponse.json({ ok: true });

    const lastSent = record.resetLastSentAt;
    if (lastSent && sumarMinutos(lastSent, RESET_COOLDOWN_MIN) > ahora) {
      return NextResponse.json(
        { error: `Esperá ${RESET_COOLDOWN_MIN} minutos antes de solicitar otro link.` },
        { status: 429 }
      );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);
    const tokenExp = sumarHoras(ahora, RESET_TOKEN_TTL_HOURS);

    if (entity === "PROFESSIONAL") {
      await prisma.professional.update({
        where: { id: record.id },
        data: { resetTokenHash: tokenHash, resetTokenExp: tokenExp, resetLastSentAt: ahora },
      });
    } else {
      await prisma.user.update({
        where: { id: record.id },
        data: { resetTokenHash: tokenHash, resetTokenExp: tokenExp, resetLastSentAt: ahora },
      });
    }

    const resetUrl = `${APP_URL}/reset-password?token=${rawToken}`;

    await sendEmail({
      to: emailNormalizado,
      subject: "Restablecer contraseña",
      html: `
        <p>Hola ${escaparHtml(record.name || "👋")}.</p>
        <p>Para restablecer tu contraseña, usá este link:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Este link vence en ${RESET_TOKEN_TTL_HOURS} hora(s).</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("request-password-reset error:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}

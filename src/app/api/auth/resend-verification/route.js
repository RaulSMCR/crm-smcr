import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const HORAS_VENCIMIENTO_VERIFICACION = 24;
const COOLDOWN_REENVIO_MIN = 2;
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
    if (!email) return NextResponse.json({ error: "Email faltante." }, { status: 400 });

    const emailNormalizado = String(email).trim().toLowerCase();
    const ahora = new Date();

    const prof = await prisma.professional.findUnique({
      where: { email: emailNormalizado },
      select: { id: true, name: true, emailVerified: true, verifyEmailLastSentAt: true },
    });

    const user = !prof
      ? await prisma.user.findUnique({
          where: { email: emailNormalizado },
          select: { id: true, name: true, emailVerified: true, verifyEmailLastSentAt: true },
        })
      : null;

    const entity = prof ? "PROFESSIONAL" : user ? "USER" : null;
    const record = prof || user;

    // Anti-enumeración (opcional): si no existe, respondemos ok igual
    if (!record) return NextResponse.json({ ok: true });

    if (record.emailVerified) return NextResponse.json({ ok: true });

    const lastSent = record.verifyEmailLastSentAt;
    if (lastSent && sumarMinutos(lastSent, COOLDOWN_REENVIO_MIN) > ahora) {
      return NextResponse.json(
        { error: `Esperá ${COOLDOWN_REENVIO_MIN} minutos antes de reenviar.` },
        { status: 429 }
      );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);
    const tokenExp = sumarHoras(ahora, HORAS_VENCIMIENTO_VERIFICACION);

    if (entity === "PROFESSIONAL") {
      await prisma.professional.update({
        where: { id: record.id },
        data: { verifyTokenHash: tokenHash, verifyTokenExp: tokenExp, verifyEmailLastSentAt: ahora },
      });
    } else {
      await prisma.user.update({
        where: { id: record.id },
        data: { verifyTokenHash: tokenHash, verifyTokenExp: tokenExp, verifyEmailLastSentAt: ahora },
      });
    }

    const verifyUrl = `${APP_URL}/verificar-email?token=${rawToken}`;

    await sendEmail({
      to: emailNormalizado,
      subject: "Verificá tu correo",
      html: `
        <p>Hola ${escaparHtml(record.name || "👋")}.</p>
        <p>Para verificar tu correo, hacé click aquí:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>Este link vence en ${HORAS_VENCIMIENTO_VERIFICACION} horas.</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("resend-verification error:", err);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}

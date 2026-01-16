// src/app/api/auth/resend-verification/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { Resend } from "resend";

const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error("Server misconfigured");
  return v;
}

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function makeVerifyToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  return { token, tokenHash };
}

async function sendVerifyEmail({ to, name, verifyUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  const subject = "Confirmá tu correo";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Confirmación de correo</h2>
      <p>Hola${name ? `, ${name}` : ""}. Para activar tu cuenta, confirmá tu correo:</p>
      <p><a href="${verifyUrl}" target="_blank" rel="noreferrer">Confirmar mi correo</a></p>
      <p>Este enlace vence en 24 horas.</p>
      <p>Si no fuiste vos, ignorá este mensaje.</p>
    </div>
  `;

  if (apiKey && from) {
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to, subject, html });
    return;
  }

  console.warn("EMAIL_NOT_CONFIGURED: faltan RESEND_API_KEY o EMAIL_FROM.");
  console.log("VERIFY_EMAIL_LINK:", verifyUrl);
}

function okGeneric() {
  // No filtra si el email existe
  return NextResponse.json({
    ok: true,
    message:
      "Si ese correo existe en nuestro sistema, te enviaremos un email de verificación.",
  });
}

export async function POST(request) {
  try {
    const APP_URL = mustEnv("APP_URL").replace(/\/$/, "");

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ message: "Email requerido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        verifyEmailLastSentAt: true,
      },
    });

    const pro = !user
      ? await prisma.professional.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            verifyEmailLastSentAt: true,
          },
        })
      : null;

    const acct = user || pro;
    if (!acct) return okGeneric();
    if (acct.emailVerified) return NextResponse.json({ ok: true, message: "Tu correo ya está verificado." });

    // ✅ Rate limit: 1 envío cada 60 segundos por cuenta
    const now = Date.now();
    const last = acct.verifyEmailLastSentAt ? new Date(acct.verifyEmailLastSentAt).getTime() : 0;
    const cooldownMs = 60 * 1000;

    if (last && now - last < cooldownMs) {
      const secs = Math.ceil((cooldownMs - (now - last)) / 1000);
      return NextResponse.json(
        { ok: false, message: `Esperá ${secs}s antes de reenviar.` },
        { status: 429 }
      );
    }

    const { token, tokenHash } = makeVerifyToken();
    const exp = new Date(Date.now() + 1000 * 60 * 60 * 24);

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          verifyTokenHash: tokenHash,
          verifyTokenExp: exp,
          verifyEmailLastSentAt: new Date(),
        },
        select: { id: true },
      });
    } else {
      await prisma.professional.update({
        where: { id: pro.id },
        data: {
          verifyTokenHash: tokenHash,
          verifyTokenExp: exp,
          verifyEmailLastSentAt: new Date(),
        },
        select: { id: true },
      });
    }

    const verifyUrl = `${APP_URL}/verificar-email?token=${encodeURIComponent(token)}`;
    await sendVerifyEmail({ to: acct.email, name: acct.name, verifyUrl });

    // Respondemos genérico igual (no filtra nada)
    return okGeneric();
  } catch (e) {
    console.error("RESEND_VERIFICATION_ERROR:", e);
    return NextResponse.json({ message: "Error interno" }, { status: 500 });
  }
}

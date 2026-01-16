// src/app/api/auth/request-password-reset/route.js
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

function makeToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  return { token, tokenHash };
}

async function sendResetEmail({ to, name, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  const subject = "Recuperar contraseña";
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>Recuperación de contraseña</h2>
      <p>Hola${name ? `, ${name}` : ""}. Pediste restablecer tu contraseña.</p>
      <p><a href="${resetUrl}" target="_blank" rel="noreferrer">Crear nueva contraseña</a></p>
      <p>Este enlace vence en 30 minutos.</p>
      <p>Si no fuiste vos, ignorá este mensaje.</p>
    </div>
  `;

  if (apiKey && from) {
    const resend = new Resend(apiKey);
    await resend.emails.send({ from, to, subject, html });
    return;
  }

  console.warn("EMAIL_NOT_CONFIGURED: faltan RESEND_API_KEY o EMAIL_FROM.");
  console.log("RESET_PASSWORD_LINK:", resetUrl);
}

function genericOk() {
  return NextResponse.json({
    ok: true,
    message:
      "Si ese correo existe en nuestro sistema, te enviaremos un enlace para recuperar la contraseña.",
  });
}

export async function POST(request) {
  try {
    const APP_URL = mustEnv("APP_URL").replace(/\/$/, "");

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return NextResponse.json({ message: "Email requerido" }, { status: 400 });

    // Buscar primero User, luego Professional (sin filtrar)
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, resetLastSentAt: true },
    });

    const pro = !user
      ? await prisma.professional.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, resetLastSentAt: true },
        })
      : null;

    const acct = user || pro;
    if (!acct) return genericOk();

    // Rate limit: 1 envío cada 60s
    const nowMs = Date.now();
    const lastMs = acct.resetLastSentAt ? new Date(acct.resetLastSentAt).getTime() : 0;
    const cooldownMs = 60 * 1000;
    if (lastMs && nowMs - lastMs < cooldownMs) return genericOk(); // no revelamos rate limit

    const { token, tokenHash } = makeToken();
    const exp = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    const now = new Date();

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: tokenHash, resetTokenExp: exp, resetLastSentAt: now },
        select: { id: true },
      });
    } else {
      await prisma.professional.update({
        where: { id: pro.id },
        data: { resetTokenHash: tokenHash, resetTokenExp: exp, resetLastSentAt: now },
        select: { id: true },
      });
    }

    const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendResetEmail({ to: acct.email, name: acct.name, resetUrl });

    return genericOk();
  } catch (e) {
    console.error("REQUEST_PASSWORD_RESET_ERROR:", e);
    return NextResponse.json({ message: "Error interno" }, { status: 500 });
  }
}

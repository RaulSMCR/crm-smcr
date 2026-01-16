// src/app/api/auth/register/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";

// ------------------------------------------------------------------
// Prisma Singleton
// ------------------------------------------------------------------
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
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

export async function POST(request) {
  try {
    const APP_URL = mustEnv("APP_URL").replace(/\/$/, "");

    const body = await request.json().catch(() => ({}));
    const { name, email, password, gender, interests } = body ?? {};

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: name, email, password" },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Hash password
    const hashedPassword = await bcrypt.hash(String(password), 12);

    // Token + exp
    const { token, tokenHash } = makeVerifyToken();
    const exp = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    // ✅ Guardamos también el momento del envío (rate limit DB)
    const now = new Date();

    // ✅ Transacción: crear user con token+exp+lastSent (todo junto)
    const newUser = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: String(name).trim(),
          email: normalizedEmail,
          passwordHash: hashedPassword,

          gender: gender ? String(gender).trim() : null,
          interests: interests ? String(interests).trim() : null,

          // Email verification
          emailVerified: false,
          verifyTokenHash: tokenHash,
          verifyTokenExp: exp,

          // ✅ Paso D (opcional): para rate limit desde el primer email
          verifyEmailLastSentAt: now,
        },
        select: {
          id: true,
          name: true,
          email: true,
          gender: true,
          interests: true,
          emailVerified: true,
        },
      });

      return created;
    });

    // Enviar email
    const verifyUrl = `${APP_URL}/verificar-email?token=${encodeURIComponent(token)}`;
    await sendVerifyEmail({ to: newUser.email, name: newUser.name, verifyUrl });

    return NextResponse.json(
      {
        ok: true,
        message:
          "Cuenta creada. Te enviamos un correo para confirmar tu email antes de iniciar sesión.",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          emailVerified: newUser.emailVerified,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("REGISTER_ERROR:", error);

    // Prisma unique constraint (email duplicado)
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";

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

export async function POST(request) {
  try {
    const body = await request.json();

    // Inputs en español + foto + resume (URL)
    const {
      nombreCompleto,
      profesion,
      email,
      telefono,
      password,

      avatarUrl, // URL de foto (opcional)
      resumeUrl, // URL del CV (opcional)  <-- si no existe en tu DB, borrá esta línea y su uso

      bio,
      introVideoUrl,
      calendarUrl,
      paymentLinkBase,
    } = body ?? {};

    if (!nombreCompleto || !profesion || !email || !password) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios (nombreCompleto, profesion, email, password)." },
        { status: 400 }
      );
    }

    const emailNormalizado = String(email).trim().toLowerCase();
    const ahora = new Date();

    // Si ya existe y NO está verificado => reemitimos token (con cooldown)
    const existente = await prisma.professional.findUnique({
      where: { email: emailNormalizado },
      select: {
        id: true,
        name: true,
        emailVerified: true,
        verifyEmailLastSentAt: true,
      },
    });

    if (existente) {
      if (existente.emailVerified) {
        return NextResponse.json(
          { error: "Ya existe un profesional con ese email." },
          { status: 409 }
        );
      }

      const lastSent = existente.verifyEmailLastSentAt;
      if (lastSent && sumarMinutos(lastSent, COOLDOWN_REENVIO_MIN) > ahora) {
        return NextResponse.json(
          { error: `Esperá ${COOLDOWN_REENVIO_MIN} minutos antes de reenviar la verificación.` },
          { status: 429 }
        );
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = sha256Hex(rawToken);
      const tokenExp = sumarHoras(ahora, HORAS_VENCIMIENTO_VERIFICACION);

      await prisma.professional.update({
        where: { id: existente.id },
        data: {
          emailVerified: false,
          verifyTokenHash: tokenHash,
          verifyTokenExp: tokenExp,
          verifyEmailLastSentAt: ahora,
        },
      });

      const verifyUrl = `${APP_URL}/verificar-email?token=${rawToken}`;

      await sendEmail({
        to: emailNormalizado,
        subject: "Verificá tu correo",
        html: `
          <p>Hola ${escaparHtml(existente.name || nombreCompleto)}.</p>
          <p>Para verificar tu correo, hacé click acá:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Este link vence en ${HORAS_VENCIMIENTO_VERIFICACION} horas.</p>
        `,
      });

      await sendEmail({
        to: emailNormalizado,
        subject: "Recibimos tu solicitud de profesional",
        html: `
          <p>Hola ${escaparHtml(existente.name || nombreCompleto)}.</p>
          <p>Recibimos tu solicitud para registrarte como profesional.</p>
          <p><strong>Un administrador te contactará para agendar una entrevista.</strong></p>
          <p>Tu perfil <strong>no estará visible</strong> en la plataforma hasta que sea validado.</p>
        `,
      });

      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Crear profesional nuevo
    const hashedPassword = await bcrypt.hash(password, 12);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256Hex(rawToken);
    const tokenExp = sumarHoras(ahora, HORAS_VENCIMIENTO_VERIFICACION);

    await prisma.professional.create({
      data: {
        name: String(nombreCompleto).trim(),
        profession: String(profesion).trim(),
        email: emailNormalizado,
        phone: telefono ? String(telefono).trim() : null,
        passwordHash: hashedPassword,

        // ✅ Foto + CV (si existen en tu modelo)
        avatarUrl: avatarUrl ? String(avatarUrl).trim() : null,
        resumeUrl: resumeUrl ? String(resumeUrl).trim() : null, // <-- si no existe en tu DB, borrá esta línea

        // opcionales (si existen en tu modelo; si no, borrá)
        bio: bio ? String(bio) : null,
        introVideoUrl: introVideoUrl ? String(introVideoUrl) : null,
        calendarUrl: calendarUrl ? String(calendarUrl) : null,
        paymentLinkBase: paymentLinkBase ? String(paymentLinkBase) : null,

        // flags
        isApproved: false,
        emailVerified: false,

        // verificación
        verifyTokenHash: tokenHash,
        verifyTokenExp: tokenExp,
        verifyEmailLastSentAt: ahora,

        // reset
        resetTokenHash: null,
        resetTokenExp: null,
        resetLastSentAt: null,
      },
    });

    // Simulación/admin
    console.log(`Nueva solicitud de profesional: ${emailNormalizado}. Revisar y contactar para entrevista.`);

    // Email 1: verificación
    const verifyUrl = `${APP_URL}/verificar-email?token=${rawToken}`;

    await sendEmail({
      to: emailNormalizado,
      subject: "Verificá tu correo",
      html: `
        <p>Hola ${escaparHtml(nombreCompleto)}.</p>
        <p>Gracias por registrarte como profesional. Para verificar tu correo, hacé click acá:</p>
        <p><a href="${verifyUrl}">${verifyUrl}</a></p>
        <p>Este link vence en ${HORAS_VENCIMIENTO_VERIFICACION} horas.</p>
      `,
    });

    // Email 2: entrevista/admin
    await sendEmail({
      to: emailNormalizado,
      subject: "Recibimos tu solicitud de profesional",
      html: `
        <p>Hola ${escaparHtml(nombreCompleto)}.</p>
        <p>Recibimos tu solicitud para registrarte como profesional en la plataforma.</p>
        <p><strong>Un administrador te contactará para agendar una entrevista.</strong></p>
        <p>Tu perfil <strong>no estará visible</strong> hasta que sea validado por el equipo.</p>
      `,
    });

    // NO autologin, NO devolvemos el record
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Professional Registration Error:", error);
    return NextResponse.json(
      { error: "No se pudo crear el profesional. Verificá si el email ya existe o si faltan datos." },
      { status: 500 }
    );
  }
}

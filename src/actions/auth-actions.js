// src/actions/auth-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { resend } from "@/lib/resend";
import { signToken, getSession as getLibSession } from "@/lib/auth";

const BASE_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://saludmentalcostarica.com");

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizePhone(v) {
  // Simple: permitimos +, números, espacios, guiones y paréntesis
  const s = String(v || "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, " ");
}

function isPhoneValid(v) {
  // Validación flexible (no country-specific), pero evita basura:
  // - mínimo 8 dígitos totales
  // - solo permite +0-9 espacios () -
  const s = normalizePhone(v);
  if (!/^[+0-9()\-\s]+$/.test(s)) return false;
  const digits = (s.match(/\d/g) || []).length;
  return digits >= 8;
}

function normalizeIdentification(v) {
  return String(v || "").trim();
}

function isIdentificationValid(v) {
  const s = normalizeIdentification(v);
  if (!s) return false;

  // Flexible: letras/números/.- espacios
  if (!/^[A-Za-z0-9.\-\s]+$/.test(s)) return false;

  // Longitud razonable
  const compact = s.replace(/\s+/g, "");
  return compact.length >= 5 && compact.length <= 32;
}

/* 0) SESIÓN */
export async function getSession() {
  return await getLibSession();
}

/* 1) LOGIN */
export async function login(formData) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  if (!email || !password) return { error: "Credenciales requeridas." };

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { professionalProfile: true },
    });

    if (!user || !user.passwordHash) return { error: "Credenciales inválidas." };

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return { error: "Credenciales inválidas." };

    if (!user.emailVerified) {
      return { error: "Debes verificar tu email primero.", code: "EMAIL_NOT_VERIFIED" };
    }

    if (!user.isActive) {
      return { error: "Esta cuenta ha sido desactivada. Contacta soporte." };
    }

    if (user.role === "PROFESSIONAL") {
      if (!user.professionalProfile) return { error: "Perfil profesional incompleto. Contacta soporte." };
      if (!user.professionalProfile.isApproved) {
        return { error: "Tu cuenta profesional está pendiente de aprobación.", code: "PRO_NOT_APPROVED" };
      }
    }

    await prisma.user
      .update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      .catch((err) => console.error("Error actualizando lastLogin:", err));

    const sessionData = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      name: user.name,
      professionalProfileId: user.professionalProfile?.id || null,
      slug: user.professionalProfile?.slug || null,
      isApproved: user.role === "PROFESSIONAL" ? !!user.professionalProfile?.isApproved : true,
    };

    const token = await signToken(sessionData);

    cookies().set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      sameSite: "lax",
      path: "/",
    });

    return { success: true, role: user.role };
  } catch (error) {
    console.error("Login error:", error);
    return { error: "Ocurrió un error inesperado." };
  }
}

/* 2) REGISTRO PROFESIONAL */
export async function registerProfessional(formData) {
  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmail(formData.get("email"));
  const phoneRaw = formData.get("phone");
  const phone = normalizePhone(phoneRaw);

  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  // opcional: si alguna vez querés pedir identificación también al profesional
  const identification = normalizeIdentification(formData.get("identification"));

  const specialty = String(formData.get("specialty") || "").trim();
  const bio = formData.get("bio") ? String(formData.get("bio")).trim() : null;
  const coverLetter = formData.get("coverLetter") ? String(formData.get("coverLetter")).trim() : null;
  const cvUrl = formData.get("cvUrl") ? String(formData.get("cvUrl")).trim() : null;
  const licenseNumber = formData.get("licenseNumber") ? String(formData.get("licenseNumber")).trim() : null;

  const acquisitionChannel = formData.get("acquisitionChannel")
    ? String(formData.get("acquisitionChannel")).trim()
    : "Directo";

  if (!name || !email || !password || !specialty) return { error: "Faltan campos obligatorios." };
  if (!phone) return { error: "El teléfono es obligatorio." };
  if (!isPhoneValid(phone)) return { error: "Teléfono inválido. Usa un número real (mínimo 8 dígitos)." };

  if (identification && !isIdentificationValid(identification)) {
    return { error: "Identificación inválida." };
  }

  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya está registrado." };

    let slugBase = name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-");
    let slug = slugBase || "profesional";
    let count = 0;

    while (
      await prisma.professionalProfile.findUnique({
        where: { slug: count === 0 ? slug : `${slug}-${count}` },
      })
    ) {
      count++;
    }
    slug = count === 0 ? slug : `${slug}-${count}`;

    const hashedPassword = await bcrypt.hash(password, 12);

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenHash = crypto.createHash("sha256").update(verifyToken).digest("hex");

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          phone,
          identification: identification || null,
          passwordHash: hashedPassword,
          role: "PROFESSIONAL",
          emailVerified: false,
          isActive: true,
          verifyTokenHash,
          verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
          acquisitionChannel,
          campaignName: "Captación Profesionales",
        },
      });

      await tx.professionalProfile.create({
        data: {
          userId: newUser.id,
          specialty,
          slug,
          bio,
          coverLetter,
          cvUrl,
          licenseNumber,
          isApproved: false,
        },
      });
    });

    if (process.env.RESEND_API_KEY) {
      const { error } = await resend.emails.send({
        from: "Salud Mental Costa Rica <onboarding@resend.dev>",
        to: email,
        subject: "Recibimos tu solicitud profesional",
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>Hola ${name},</h2>
            <p>Hemos recibido tu solicitud.</p>
            <p>Por favor confirma tu correo para continuar:</p>
            <p>
              <a href="${BASE_URL}/verificar-email?token=${verifyToken}"
                 style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Verificar Email
              </a>
            </p>
          </div>
        `,
      });
      if (error) console.error("❌ Error enviando email a Profesional:", error);
    }

    return { success: true };
  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error al crear la cuenta. Inténtalo de nuevo." };
  }
}

/* 3) REGISTRO PACIENTE */
export async function registerUser(formData) {
  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmail(formData.get("email"));
  const phoneRaw = formData.get("phone");
  const phone = normalizePhone(phoneRaw);

  const identification = normalizeIdentification(formData.get("identification"));

  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const acquisitionChannel = formData.get("acquisitionChannel")
    ? String(formData.get("acquisitionChannel")).trim()
    : "Directo";

  if (!name || !email || !password) return { error: "Datos incompletos." };
  if (!phone) return { error: "El teléfono es obligatorio." };
  if (!isPhoneValid(phone)) return { error: "Teléfono inválido. Usa un número real (mínimo 8 dígitos)." };

  // ✅ identificación obligatoria a nivel app (sin romper DB existente)
  if (!identification) return { error: "La identificación es obligatoria." };
  if (!isIdentificationValid(identification)) return { error: "Identificación inválida." };

  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya está registrado." };

    const hashedPassword = await bcrypt.hash(password, 12);

    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenHash = crypto.createHash("sha256").update(verifyToken).digest("hex");

    await prisma.user.create({
      data: {
        name,
        email,
        phone,
        identification,
        passwordHash: hashedPassword,
        role: "USER",
        emailVerified: false,
        isActive: true,
        verifyTokenHash,
        verifyTokenExp: new Date(Date.now() + 24 * 60 * 60 * 1000),
        acquisitionChannel,
      },
    });

    if (process.env.RESEND_API_KEY) {
      const { error } = await resend.emails.send({
        from: "Salud Mental Costa Rica <onboarding@resend.dev>",
        to: email,
        subject: "Bienvenido a SMCR - Confirma tu cuenta",
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>¡Bienvenido, ${name}!</h2>
            <p>Para activar tu cuenta, confirma tu correo:</p>
            <p>
              <a href="${BASE_URL}/verificar-email?token=${verifyToken}"
                 style="background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                Verificar mi Email
              </a>
            </p>
          </div>
        `,
      });
      if (error) console.error("❌ RESEND API ERROR:", error);
    }

    return { success: true };
  } catch (error) {
    // Manejo de unique si más adelante lo volvés @unique
    if (error?.code === "P2002") {
      return { error: "Ya existe un usuario con ese dato único. Revisa email/identificación." };
    }
    console.error("Error registro usuario:", error);
    return { error: "Error al registrarse. Inténtalo de nuevo." };
  }
}

/* 4) VERIFICACIÓN EMAIL */
export async function verifyEmail(token) {
  const t = String(token || "");
  if (!t) return { error: "Token inválido." };

  const tokenHash = crypto.createHash("sha256").update(t).digest("hex");

  try {
    const user = await prisma.user.findFirst({
      where: { verifyTokenHash: tokenHash, verifyTokenExp: { gt: new Date() } },
    });

    if (!user) return { error: "Token inválido o expirado." };

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyTokenHash: null, verifyTokenExp: null },
    });

    return { success: true, role: user.role, email: user.email };
  } catch (error) {
    console.error("Error verificando email:", error);
    return { error: "Error al verificar." };
  }
}

/* 5) LOGOUT */
export async function logout() {
  try {
    cookies().delete("session");
  } catch (error) {
    console.error("Error al borrar cookie en logout (no crítico):", error);
  }

  revalidatePath("/", "layout");
  redirect("/ingresar");
}

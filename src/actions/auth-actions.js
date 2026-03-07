// src/actions/auth-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { sendVerificationEmail } from "@/lib/mail";
import { signToken, getSession as getLibSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  const phone = String(value || "").trim();
  if (!phone) return "";
  return phone.replace(/\s+/g, " ");
}

function isPhoneValid(value) {
  const phone = normalizePhone(value);
  if (!/^[+0-9()\-\s]+$/.test(phone)) return false;
  const digits = (phone.match(/\d/g) || []).length;
  return digits >= 8;
}

function normalizeIdentification(value) {
  return String(value || "").trim();
}

function isIdentificationValid(value) {
  const identification = normalizeIdentification(value);
  if (!identification) return false;
  if (!/^[A-Za-z0-9.\-\s]+$/.test(identification)) return false;
  const compact = identification.replace(/\s+/g, "");
  return compact.length >= 5 && compact.length <= 32;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getSession() {
  return await getLibSession();
}

export async function login(formData) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") || "");

  if (!email || !password) return { error: "Credenciales requeridas." };

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { professionalProfile: true },
    });

    if (!user || !user.passwordHash) return { error: "Credenciales invÃ¡lidas." };

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return { error: "Credenciales invÃ¡lidas." };

    if (!user.emailVerified) {
      return { error: "Debe verificar el correo electrónico antes de continuar.", code: "EMAIL_NOT_VERIFIED" };
    }

    if (!user.isActive) {
      return { error: "Esta cuenta ha sido desactivada. Por favor, contacte soporte." };
    }

    if (user.role === "PROFESSIONAL") {
      if (!user.professionalProfile) return { error: "El perfil profesional está incompleto. Por favor, contacte soporte." };
      if (!user.professionalProfile.isApproved) {
        return { error: "La cuenta profesional se encuentra pendiente de aprobación.", code: "PRO_NOT_APPROVED" };
      }
    }

    await prisma.user
      .update({ where: { id: user.id }, data: { lastLogin: new Date() } })
      .catch((error) => console.error("Error actualizando lastLogin:", error));

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
    return { error: "OcurriÃ³ un error inesperado." };
  }
}

export async function registerProfessional(formData) {
  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmail(formData.get("email"));
  const phone = normalizePhone(formData.get("phone"));
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const identification = normalizeIdentification(formData.get("identification"));
  const specialty = String(formData.get("specialty") || "").trim();
  const bio = formData.get("bio") ? String(formData.get("bio")).trim() : null;
  const coverLetter = formData.get("coverLetter") ? String(formData.get("coverLetter")).trim() : null;
  const cvUrl = formData.get("cvUrl") ? String(formData.get("cvUrl")).trim() : null;
  const introVideoUrl = formData.get("introVideoUrl") ? String(formData.get("introVideoUrl")).trim() : null;
  const licenseNumber = formData.get("licenseNumber") ? String(formData.get("licenseNumber")).trim() : null;

  const acquisitionChannel = formData.get("acquisitionChannel")
    ? String(formData.get("acquisitionChannel")).trim()
    : "Directo";

  if (!name || !email || !password || !specialty) return { error: "Faltan campos obligatorios." };
  if (!phone) return { error: "El telÃ©fono es obligatorio." };
  if (!isPhoneValid(phone)) return { error: "TelÃ©fono invÃ¡lido. Usa un nÃºmero real (mÃ­nimo 8 dÃ­gitos)." };
  if (identification && !isIdentificationValid(identification)) return { error: "IdentificaciÃ³n invÃ¡lida." };
  if (password !== confirmPassword) return { error: "Las contraseÃ±as no coinciden." };
  if (password.length < 8) return { error: "La contraseÃ±a debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya estÃ¡ registrado." };

    let slugBase = name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-");
    let slug = slugBase || "profesional";
    let count = 0;

    while (
      await prisma.professionalProfile.findUnique({
        where: { slug: count === 0 ? slug : `${slug}-${count}` },
      })
    ) {
      count += 1;
    }

    slug = count === 0 ? slug : `${slug}-${count}`;

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenHash = crypto.createHash("sha256").update(verifyToken).digest("hex");

    let createdUser = null;
    await prisma.$transaction(async (tx) => {
      createdUser = await tx.user.create({
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
          campaignName: "CaptaciÃ³n Profesionales",
        },
      });

      await tx.professionalProfile.create({
        data: {
          userId: createdUser.id,
          specialty,
          slug,
          bio,
          coverLetter,
          cvUrl,
          introVideoUrl,
          licenseNumber,
          isApproved: false,
        },
      });
    });

    try {
      if (cvUrl && createdUser) {
        const parsed = new URL(cvUrl);
        const marker = "/CVS/";
        const idx = parsed.pathname.indexOf(marker);

        if (idx !== -1) {
          const srcPath = parsed.pathname.substring(idx + marker.length);
          const parts = srcPath.split(".");
          const ext = parts.length > 1 ? parts.pop() : "pdf";
          const destPath = `${createdUser.id}/cv.${ext}`;

          const { error: moveError } = await supabaseAdmin.storage.from("CVS").move(srcPath, destPath);

          if (moveError) {
            console.error("Error moviendo CV en Supabase:", moveError);
          } else {
            const { data } = supabaseAdmin.storage.from("CVS").getPublicUrl(destPath);
            if (data?.publicUrl) {
              await prisma.user.update({ where: { id: createdUser.id }, data: {} }).catch(() => {});
              await prisma.professionalProfile
                .update({ where: { userId: createdUser.id }, data: { cvUrl: data.publicUrl } })
                .catch(() => {});
            }
          }
        }
      }
    } catch (error) {
      console.error("Error handling CV move:", error);
    }

    if (process.env.RESEND_API_KEY) {
      try {
        await sendVerificationEmail(email, verifyToken);
      } catch (error) {
        console.error("Error enviando email de verificacion a profesional:", error);
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error al crear la cuenta. IntÃ©ntalo de nuevo." };
  }
}

export async function registerUser(formData) {
  const name = String(formData.get("name") || "").trim();
  const email = normalizeEmail(formData.get("email"));
  const phone = normalizePhone(formData.get("phone"));
  const identification = normalizeIdentification(formData.get("identification"));
  const birthDateRaw = String(formData.get("birthDate") || "").trim();
  const birthDate = birthDateRaw ? new Date(`${birthDateRaw}T00:00:00.000Z`) : null;
  const gender = String(formData.get("gender") || "").trim() || null;
  const interests = String(formData.get("interests") || "").trim() || null;
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  const acquisitionChannel = formData.get("acquisitionChannel")
    ? String(formData.get("acquisitionChannel")).trim()
    : "Directo";

  if (!name || !email || !password) return { error: "Datos incompletos." };
  if (!phone) return { error: "El telÃ©fono es obligatorio." };
  if (!isPhoneValid(phone)) return { error: "TelÃ©fono invÃ¡lido. Usa un nÃºmero real (mÃ­nimo 8 dÃ­gitos)." };
  if (!identification) return { error: "La identificaciÃ³n es obligatoria." };
  if (!isIdentificationValid(identification)) return { error: "IdentificaciÃ³n invÃ¡lida." };
  if (birthDateRaw && Number.isNaN(birthDate?.getTime?.())) return { error: "Fecha de nacimiento invÃ¡lida." };
  if (password !== confirmPassword) return { error: "Las contraseÃ±as no coinciden." };
  if (password.length < 8) return { error: "La contraseÃ±a debe tener al menos 8 caracteres." };

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "El correo ya estÃ¡ registrado." };

    const hashedPassword = await bcrypt.hash(password, 12);
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenHash = crypto.createHash("sha256").update(verifyToken).digest("hex");

    await prisma.user.create({
      data: {
        name,
        email,
        phone,
        identification,
        birthDate,
        gender,
        interests,
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
      try {
        await sendVerificationEmail(email, verifyToken);
      } catch (error) {
        console.error("Error enviando email de verificacion a paciente:", error);
      }
    }

    return { success: true };
  } catch (error) {
    if (error?.code === "P2002") {
      return { error: "Ya existe un usuario con ese dato único. Revise correo/identificación." };
    }
    console.error("Error registro usuario:", error);
    return { error: "Error al registrarse. IntÃ©ntalo de nuevo." };
  }
}

export async function verifyEmail(token) {
  const rawToken = String(token || "");
  if (!rawToken) return { error: "Token invÃ¡lido." };

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  try {
    const user = await prisma.user.findFirst({
      where: { verifyTokenHash: tokenHash, verifyTokenExp: { gt: new Date() } },
    });

    if (!user) return { error: "Token invÃ¡lido o expirado." };

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

export async function logout() {
  try {
    cookies().delete("session");
  } catch (error) {
    console.error("Error al borrar cookie en logout (no crÃ­tico):", error);
  }

  revalidatePath("/", "layout");
  redirect("/ingresar");
}



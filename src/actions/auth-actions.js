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

function isEmailValid(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getPasswordIssues(password, confirmPassword) {
  const issues = [];
  if (String(password || "").length < 8) issues.push("Debe incluir al menos 8 caracteres.");
  if (!/\d/.test(String(password || ""))) issues.push("Debe incluir al menos un número.");
  if (!/[!@#$%^&*(),.?\":{}|<>]/.test(String(password || ""))) issues.push("Debe incluir al menos un símbolo.");
  if (String(password || "") !== String(confirmPassword || "")) issues.push("La confirmación no coincide.");
  return issues;
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

    if (!user || !user.passwordHash) return { error: "Credenciales inválidas." };

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return { error: "Credenciales inválidas." };

    if (!user.emailVerified) {
      return { error: "Debe verificar el correo electrónico antes de continuar.", code: "EMAIL_NOT_VERIFIED" };
    }

    if (!user.isActive) {
      return { error: "Esta cuenta ha sido desactivada. Por favor, contacte soporte." };
    }

    if (user.role === "PROFESSIONAL") {
      if (!user.professionalProfile) return { error: "El perfil profesional está incompleto. Por favor, contacte soporte." };
      if (!user.professionalProfile.isApproved) {
        return {
          error:
            "Su postulación está en revisión. El coordinador del sitio le estará contactando para agendar una entrevista.",
          code: "PRO_NOT_APPROVED",
        };
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
    return { error: "Ocurrió un error inesperado." };
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

  if (!name) return { error: "Falta el nombre completo para continuar con el registro." };
  if (!email) return { error: "Falta el correo electrónico para proteger y validar el acceso." };
  if (!isEmailValid(email)) return { error: "El correo electrónico no tiene un formato válido." };
  if (!phone) return { error: "Falta el teléfono de contacto para continuar con seguridad." };
  if (!isPhoneValid(phone)) return { error: "El teléfono no es válido. Debe incluir al menos 8 dígitos." };
  if (!specialty) return { error: "Falta indicar la especialidad profesional." };
  if (!licenseNumber) return { error: "Falta el número de licencia o matrícula profesional." };
  if (!cvUrl) return { error: "Falta adjuntar el CV en PDF para validar credenciales profesionales." };
  if (identification && !isIdentificationValid(identification)) return { error: "La identificación ingresada no es válida." };
  if (introVideoUrl) {
    try {
      new URL(introVideoUrl);
    } catch {
      return { error: "La URL del video de introducción no es válida." };
    }
  }
  const professionalPasswordIssues = getPasswordIssues(password, confirmPassword);
  if (professionalPasswordIssues.length > 0) {
    return {
      error: `No fue posible completar la seguridad de la cuenta. ${professionalPasswordIssues.join(" ")}`,
    };
  }

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
          campaignName: "Captación Profesionales",
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

    let verificationEmailSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        await sendVerificationEmail(email, verifyToken);
        verificationEmailSent = true;
      } catch (error) {
        console.error("Error enviando email de verificacion a profesional:", error);
      }
    }

    if (!process.env.RESEND_API_KEY || !verificationEmailSent) {
      return {
        success: true,
        warning:
          "El perfil fue creado, pero no fue posible enviar el correo de verificación en este momento. Para proteger su acceso, solicite reenvío del enlace desde la pantalla de verificación.",
      };
    }

    return { success: true, message: "Registro completado. Se envió un correo de verificación para continuar de forma segura." };
  } catch (error) {
    console.error("Error registro profesional:", error);
    return { error: "Error al crear la cuenta. Inténtalo de nuevo." };
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

  if (!name) return { error: "Falta el nombre completo para crear la cuenta." };
  if (!email) return { error: "Falta el correo electrónico para proteger y validar el acceso." };
  if (!isEmailValid(email)) return { error: "El correo electrónico no tiene un formato válido." };
  if (!phone) return { error: "Falta el teléfono de contacto para coordinar la atención de forma segura." };
  if (!isPhoneValid(phone)) return { error: "El teléfono no es válido. Debe incluir al menos 8 dígitos." };
  if (!identification) return { error: "Falta la identificación para completar el registro seguro." };
  if (!isIdentificationValid(identification)) return { error: "La identificación ingresada no es válida." };
  if (birthDateRaw && Number.isNaN(birthDate?.getTime?.())) return { error: "La fecha de nacimiento no es válida." };
  const userPasswordIssues = getPasswordIssues(password, confirmPassword);
  if (userPasswordIssues.length > 0) {
    return {
      error: `No fue posible completar la seguridad de la cuenta. ${userPasswordIssues.join(" ")}`,
    };
  }

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

    let verificationEmailSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        await sendVerificationEmail(email, verifyToken);
        verificationEmailSent = true;
      } catch (error) {
        console.error("Error enviando email de verificacion a paciente:", error);
      }
    }

    if (!process.env.RESEND_API_KEY || !verificationEmailSent) {
      return {
        success: true,
        warning:
          "La cuenta fue creada, pero no fue posible enviar el correo de verificación en este momento. Para proteger su acceso, solicite reenvío del enlace desde la pantalla de verificación.",
      };
    }

    return { success: true, message: "Registro completado. Se envió un correo de verificación para continuar de forma segura." };
  } catch (error) {
    if (error?.code === "P2002") {
      return { error: "Ya existe un usuario con ese dato único. Revise correo/identificación." };
    }
    console.error("Error registro usuario:", error);
    return { error: "Error al registrarse. Inténtalo de nuevo." };
  }
}

export async function verifyEmail(token) {
  const rawToken = String(token || "");
  if (!rawToken) return { error: "Token inválido." };

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

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

export async function logout() {
  try {
    cookies().delete("session");
  } catch (error) {
    console.error("Error al borrar cookie en logout (no crítico):", error);
  }

  revalidatePath("/", "layout");
  redirect("/ingresar");
}




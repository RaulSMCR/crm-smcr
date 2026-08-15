// src/actions/patient-profile-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import { revalidatePath } from "next/cache";
import { sendInsuranceAdminAlert } from "@/lib/insurance-mail";
import { validarIdentificacionFiscal } from "@/lib/fiscal-identity";

const s = (v) => String(v ?? "").trim();

function isPhoneValid(v) {
  const phone = s(v);
  if (!phone) return false;
  if (!/^[+0-9()\-\s]+$/.test(phone)) return false;
  const digits = (phone.match(/\d/g) || []).length;
  return digits >= 8;
}

function isIdentificationValid(v) {
  const id = s(v);
  if (!id) return false;
  if (!/^[A-Za-z0-9.\-\s]+$/.test(id)) return false;
  const compact = id.replace(/\s+/g, "");
  return compact.length >= 5 && compact.length <= 32;
}

export async function updatePatientProfile(formData) {
  const session = await getSession();
  if (!session) return { error: "No autenticado." };
  if (session.role !== "USER") return { error: "No autorizado." };

  const userId = String(session.userId || session.sub);

  const name = s(formData.get("name"));
  const phone = s(formData.get("phone"));
  const identification = s(formData.get("identification"));
  const birthDateRaw = s(formData.get("birthDate"));
  const gender = s(formData.get("gender")) || null;
  const interests = s(formData.get("interests")) || null;

  if (!name) return { error: "El nombre es obligatorio." };
  if (!phone) return { error: "El teléfono es obligatorio." };
  if (!isPhoneValid(phone)) return { error: "Teléfono inválido (mínimo 8 dígitos)." };

  // obligatoria a nivel app
  if (!identification) return { error: "La identificación es obligatoria." };
  if (!isIdentificationValid(identification)) return { error: "Identificación inválida." };

  let birthDate = null;
  if (birthDateRaw) {
    const d = new Date(birthDateRaw);
    if (Number.isNaN(d.getTime())) return { error: "Fecha de nacimiento inválida." };
    birthDate = d;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
        identification: identification || null,
        birthDate,
        gender,
        interests,
      },
    });

    revalidatePath("/panel/paciente");
    return { success: true };
  } catch (e) {
    console.error("updatePatientProfile error:", e);
    return { error: "No se pudo guardar la información. Por favor, inténtelo nuevamente." };
  }
}

/**
 * Datos con los que se emite la factura del paciente.
 *
 * Sirven para pedirla a nombre de una empresa y poder deducirla. Son opcionales
 * y todo-o-nada: con el nombre a medias saldría un comprobante que no sirve
 * para deducir y que Hacienda igual aceptaría, así que o van los dos campos o
 * se borran ambos y rige la identidad de la cuenta.
 */
export async function updateBillingInfo(formData) {
  const session = await getSession();
  if (!session) return { error: "No autenticado." };
  if (session.role !== "USER") return { error: "No autorizado." };

  const userId = String(session.userId || session.sub);

  const billingName = s(formData.get("billingName"));
  const billingIdType = s(formData.get("billingIdType"));
  const billingIdNumber = s(formData.get("billingIdNumber"));
  const billingEmail = s(formData.get("billingEmail"));

  // Vaciar los tres campos es la forma de volver a facturar a nombre propio.
  if (!billingName && !billingIdNumber) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { billingName: null, billingIdType: null, billingIdNumber: null, billingEmail: null },
      });
      revalidatePath("/panel/paciente");
      return { success: true, cleared: true };
    } catch (e) {
      console.error("updateBillingInfo error:", e);
      return { error: "No se pudo guardar. Por favor, inténtelo nuevamente." };
    }
  }

  if (!billingName) {
    return { error: "Indique el nombre o razón social a quien se emite la factura." };
  }

  const validacion = validarIdentificacionFiscal(billingIdType, billingIdNumber);
  if (!validacion.ok) return { error: validacion.error };

  if (billingEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billingEmail)) {
    return { error: "El correo para la factura no es válido." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        billingName,
        billingIdType,
        billingIdNumber: validacion.numero,
        billingEmail: billingEmail || null,
      },
    });

    revalidatePath("/panel/paciente");
    return { success: true };
  } catch (e) {
    console.error("updateBillingInfo error:", e);
    return { error: "No se pudo guardar la información de facturación." };
  }
}

export async function updateInsuranceInfo(formData) {
  const session = await getSession();
  if (!session) return { error: "No autenticado." };
  if (session.role !== "USER") return { error: "No autorizado." };

  const userId = String(session.userId || session.sub);

  const hasInsurance = formData.get("hasInsurance") === "true";
  const useInsuranceForPayment = hasInsurance && formData.get("useInsuranceForPayment") === "true";
  const insuranceName = useInsuranceForPayment
    ? s(formData.get("insuranceName")) || null
    : null;

  try {
    const prev = await prisma.user.findUnique({
      where: { id: userId },
      select: { useInsuranceForPayment: true, name: true },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { hasInsurance, useInsuranceForPayment, insuranceName },
    });

    // Alerta al admin solo cuando se activa por primera vez
    if (useInsuranceForPayment && !prev?.useInsuranceForPayment) {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN" },
        select: { email: true },
      });
      const adminEmails = admins.map((a) => a.email).filter(Boolean);
      sendInsuranceAdminAlert({
        adminEmails,
        patientName: prev?.name || "Paciente",
        insuranceName: insuranceName || "no especificado",
      }).catch((e) => console.error("[updateInsuranceInfo] email error:", e));
    }

    revalidatePath("/panel/paciente");
    return { success: true };
  } catch (e) {
    console.error("updateInsuranceInfo error:", e);
    return { error: "No se pudo guardar la información de seguro." };
  }
}


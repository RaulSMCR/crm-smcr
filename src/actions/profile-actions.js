// src/actions/profile-actions.js
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireProfessionalContext } from "@/lib/auth-guards";
import { normalizarGrado } from "@/lib/grados-academicos";
import { validarIban } from "@/lib/iban";
import { revalidarPreciosPublicos } from "@/lib/revalidar-precios";

function toStr(x) {
  if (x === undefined || x === null) return "";
  return String(x);
}

function normalizePhone(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.replace(/\s+/g, " ");
}

function isPhoneValid(v) {
  const s = normalizePhone(v);
  if (!s) return false;
  if (!/^[+0-9()\-\s]+$/.test(s)) return false;
  const digits = (s.match(/\d/g) || []).length;
  return digits >= 8;
}

/**
 * Misma regla que usa el paciente en `patient-profile-actions.js`: cédula
 * nacional, DIMEX o pasaporte, así que se acepta alfanumérico con puntos y
 * guiones en vez de imponer el formato de la cédula tica.
 */
function isIdentificationValid(v) {
  const id = String(v || "").trim();
  if (!id) return false;
  if (!/^[A-Za-z0-9.\-\s]+$/.test(id)) return false;
  const compact = id.replace(/\s+/g, "");
  return compact.length >= 5 && compact.length <= 32;
}

/**
 * UPDATE PERFIL (Profesional)
 * - User: name, phone, identification, image
 * - ProfessionalProfile: specialty, licenseNumber, bio, profileReviewDraft
 * - ServiceAssignment:
 *    - si selecciona un servicio NUEVO => create PENDING
 *    - si estaba REJECTED y lo re-selecciona => pasa a PENDING
 *    - si deselecciona => delete assignment
 *    - si está APPROVED y cambia el precio => se propone en su tarifa general;
 *      la consulta sigue publicada al precio vigente hasta que un admin apruebe
 *
 * Devuelve `cambios`: la lista de lo que el guardado hizo con cada consulta, para
 * que el profesional sepa qué quedó en revisión y qué ya se aplicó.
 */
export async function updateProfile(formData) {
  try {
    const { session, professionalProfileId } = await requireProfessionalContext();

    const name = toStr(formData.get("name")).trim();
    const phoneRaw = formData.get("phone");
    const phone = normalizePhone(phoneRaw);
    const identificationRaw = formData.get("identification");
    const identification = toStr(identificationRaw).trim();
    const specialty = toStr(formData.get("specialty")).trim();
    const academicDegreeRaw = formData.get("academicDegree");
    const academicDegree = normalizarGrado(academicDegreeRaw);
    const domicilioRaw = formData.get("domicilio");
    const domicilio = toStr(domicilioRaw).trim().slice(0, 200) || null;
    const ibanRaw = formData.get("iban");
    const ibanIngresado = toStr(ibanRaw).trim();
    const licenseNumber = toStr(formData.get("licenseNumber")).trim() || null;
    const bio = toStr(formData.get("bio")).trim() || null;
    const profileReviewDraft = toStr(formData.get("profileReviewDraft")).trim() || null;
    const imageUrl = toStr(formData.get("imageUrl")).trim() || null;
    const seo = {
      metaTitle: toStr(formData.get("metaTitle")).trim() || null,
      metaDescription: toStr(formData.get("metaDescription")).trim() || null,
      ogImage: toStr(formData.get("ogImage")).trim() || null,
      focusKeyword: toStr(formData.get("focusKeyword")).trim() || null,
      noindex: toStr(formData.get("noindex")) === "true",
    };

    if (!name) return { success: false, error: "El nombre es obligatorio." };
    if (!specialty) return { success: false, error: "La especialidad es obligatoria." };

    if (phoneRaw !== null && phoneRaw !== undefined) {
      if (!phone) return { success: false, error: "El teléfono es obligatorio." };
      if (!isPhoneValid(phone)) return { success: false, error: "Teléfono inválido." };
    }

    // Se valida solo si el formulario mandó el campo, para no romper a quien
    // guarde el perfil desde una pantalla que no lo incluya. Vacío es válido:
    // borra el dato. Lo que no se acepta es un valor con formato imposible.
    if (identificationRaw !== null && identificationRaw !== undefined && identification) {
      if (!isIdentificationValid(identification)) {
        return { success: false, error: "La identificación no es válida." };
      }
    }

    // Mismo criterio que la identificación: solo se valida si el formulario lo
    // mandó. Un grado que no está en el catálogo se rechaza en vez de guardarse,
    // porque termina impreso en un comprobante fiscal.
    if (academicDegreeRaw !== null && academicDegreeRaw !== undefined) {
      if (toStr(academicDegreeRaw).trim() && !academicDegree) {
        return { success: false, error: "El título profesional no es válido." };
      }
    }

    // Un IBAN mal tipeado no rebota: el dinero va a otra cuenta o a ninguna, y
    // el error aparece días después. Se comprueban los dígitos de control antes
    // de guardarlo, no cuando alguien reclame que no le llegó la liquidación.
    let iban = null;
    if (ibanRaw !== null && ibanRaw !== undefined && ibanIngresado) {
      const revision = validarIban(ibanIngresado);
      if (!revision.valido) return { success: false, error: revision.error };
      iban = revision.iban;
    }

    const requestedServiceIds = (formData.getAll("serviceIds") || [])
      .map((x) => toStr(x))
      .filter(Boolean);

    const proposedPricesEntries = (formData.getAll("proposedPrice") || [])
      .map((entry) => toStr(entry).split(":", 2))
      .filter(([serviceId, amount]) => serviceId && amount !== undefined)
      .map(([serviceId, amount]) => [serviceId, Number(amount)]);
    const proposedPricesByService = new Map(
      proposedPricesEntries.filter(([, amount]) => Number.isFinite(amount) && amount >= 0)
    );

    // Validar que existan y estén activos (evita ids basura)
    const [existingProfile, validServices] = await Promise.all([
      prisma.professionalProfile.findUnique({
        where: { id: professionalProfileId },
        select: {
          slug: true,
          profileReview: true,
          profileReviewDraft: true,
          profileReviewStatus: true,
        },
      }),
      prisma.service.findMany({
        where: { id: { in: requestedServiceIds }, isActive: true },
        select: { id: true, price: true, title: true },
      }),
    ]);

    if (!existingProfile) return { success: false, error: "Perfil profesional no encontrado." };

    const selectedIds = new Set(validServices.map((s) => s.id));
    const catalogPriceById = new Map(validServices.map((s) => [s.id, Number(s.price)]));
    const tituloPorServicio = new Map(validServices.map((s) => [s.id, s.title || "Consulta"]));

    // Una sola regla: hay algo que revisar cuando el texto que el profesional
    // tiene en el editor NO es el que está publicado.
    //
    // Antes se comparaba contra `profileReviewDraft ?? profileReview`, y eso
    // abría dos huecos. Con un borrador guardado, el texto nuevo se comparaba
    // contra ese borrador y no contra lo publicado, así que un cambio real
    // podía darse por no-cambio y el guardado devolvía "Perfil guardado
    // correctamente" sin haber enviado nada a revisión. Y al revés: un borrador
    // idéntico a lo publicado quedaba almacenado con estado APPROVED, invisible
    // para el admin —que solo veía los PENDING— y visible para el profesional,
    // que abría el editor con un texto que la página pública no mostraba.
    const resenaPublicada = toStr(existingProfile.profileReview).trim() || null;
    const tocaLaResena = formData.has("profileReviewDraft");
    const resenaPendiente = tocaLaResena && profileReviewDraft !== resenaPublicada;
    // El profesional mandó exactamente lo publicado: no hay nada que aprobar, y
    // cualquier borrador que hubiera quedado dando vueltas se limpia acá.
    const resenaSinCambios = tocaLaResena && !resenaPendiente;

    // Leer asignaciones actuales y la tarifa general (sin lugar ni franja) de
    // cada servicio, que es la que edita este formulario.
    const [currentAssignments, tarifasGenerales] = await Promise.all([
      prisma.serviceAssignment.findMany({
        where: { professionalId: professionalProfileId },
        select: {
          serviceId: true,
          status: true,
          proposedSessionPrice: true,
          approvedSessionPrice: true,
          service: { select: { title: true } },
        },
      }),
      prisma.professionalRate.findMany({
        where: { professionalId: professionalProfileId, locationId: null, timeBandId: null },
        select: { id: true, serviceId: true, status: true, approvedPrice: true, proposedPrice: true },
      }),
    ]);
    const currentMap = new Map(currentAssignments.map((a) => [a.serviceId, a]));
    const catchAllByService = new Map(tarifasGenerales.map((rate) => [rate.serviceId, rate]));

    const tx = [];
    const cambios = [];
    let tarifasEnRevision = 0;
    let preciosPublicosCambiados = false;

    // Update del perfil + user embebido
    tx.push(
      prisma.professionalProfile.update({
        where: { id: professionalProfileId },
        data: {
          specialty,
          licenseNumber,
          bio,
          ...(academicDegreeRaw !== null && academicDegreeRaw !== undefined
            ? { academicDegree }
            : {}),
          ...(domicilioRaw !== null && domicilioRaw !== undefined ? { domicilio } : {}),
          ...(ibanRaw !== null && ibanRaw !== undefined ? { iban } : {}),
          ...seo,
          ...(resenaPendiente
            ? {
                profileReviewDraft,
                profileReviewStatus: "PENDING",
                profileReviewSubmittedAt: new Date(),
                profileReviewReviewedAt: null,
                profileReviewAdminNote: null,
              }
            : {}),
          ...(resenaSinCambios
            ? {
                profileReviewDraft: null,
                profileReviewStatus: resenaPublicada ? "APPROVED" : "EMPTY",
                profileReviewAdminNote: null,
              }
            : {}),
          user: {
            update: {
              name,
              ...(phoneRaw !== null && phoneRaw !== undefined ? { phone } : {}),
              ...(identificationRaw !== null && identificationRaw !== undefined
                ? { identification: identification || null }
                : {}),
              ...(imageUrl ? { image: imageUrl } : {}),
            },
          },
        },
      })
    );

    // Deletes (deseleccionados)
    for (const a of currentAssignments) {
      if (!selectedIds.has(a.serviceId)) {
        tx.push(
          prisma.serviceAssignment.delete({
            where: {
              professionalId_serviceId: {
                professionalId: professionalProfileId,
                serviceId: a.serviceId,
              },
            },
          })
        );
        preciosPublicosCambiados = true;
        cambios.push({ tipo: "CONSULTA_QUITADA", servicio: a.service?.title || "Consulta" });
      }
    }

    // Creates / Updates (seleccionados)
    for (const serviceId of selectedIds) {
      const existingAssignment = currentMap.get(serviceId);
      const existingStatus = existingAssignment?.status;
      const nextProposedPrice = proposedPricesByService.get(serviceId) ?? null;
      const servicio = tituloPorServicio.get(serviceId) || "Consulta";

      if (!existingStatus) {
        // Nuevo => PENDING
        tx.push(
          prisma.serviceAssignment.create({
            data: {
              professionalId: professionalProfileId,
              serviceId,
              status: "PENDING",
              requestedAt: new Date(),
              reviewedAt: null,
              proposedSessionPrice: nextProposedPrice,
              approvedSessionPrice: null,
              adminReviewNote: null,
            },
          })
        );
        cambios.push({ tipo: "CONSULTA_SOLICITADA", servicio });
        continue;
      }

      if (existingStatus === "REJECTED") {
        // Re-solicitud => vuelve a PENDING
        tx.push(
          prisma.serviceAssignment.update({
            where: {
              professionalId_serviceId: { professionalId: professionalProfileId, serviceId },
            },
            data: {
              status: "PENDING",
              requestedAt: new Date(),
              reviewedAt: null,
              proposedSessionPrice: nextProposedPrice,
              approvedSessionPrice: null,
              adminReviewNote: null,
            },
          })
        );
        cambios.push({ tipo: "CONSULTA_SOLICITADA", servicio });
        continue;
      }

      if (existingStatus === "PENDING") {
        tx.push(
          prisma.serviceAssignment.update({
            where: {
              professionalId_serviceId: { professionalId: professionalProfileId, serviceId },
            },
            data: {
              proposedSessionPrice: nextProposedPrice,
            },
          })
        );
        continue;
      }

      if (existingStatus === "APPROVED") {
        // Una consulta aprobada no vuelve a revisión por cambiar el precio. Antes
        // pasaba a PENDING y perdía su precio aprobado: el servicio desaparecía
        // del sitio —ficha, hub, agenda— hasta que un admin la re-aprobara, y aun
        // aprobada el monto nuevo no llegaba a la tarifa, que es de donde lee todo
        // el sitio. Ahora el monto se propone en la tarifa general y el precio
        // vigente sigue rigiendo hasta que se revise en Tarifas.
        if (nextProposedPrice === null || nextProposedPrice <= 0) continue;

        const general = catchAllByService.get(serviceId) || null;
        const aprobado = Number(general?.approvedPrice);
        const propuesto = Number(general?.proposedPrice);
        const sinCambios =
          Boolean(general) &&
          ((general.status === "APPROVED" && aprobado === nextProposedPrice) ||
            (general.status === "PENDING" && propuesto === nextProposedPrice));
        if (sinCambios) continue;

        // Misma regla que proposeRate: volver al precio ya aprobado o cobrar el de
        // catálogo no es una decisión nueva y no espera revisión.
        const sinDecisionNueva =
          nextProposedPrice === aprobado || nextProposedPrice === catalogPriceById.get(serviceId);
        const revision = sinDecisionNueva
          ? { status: "APPROVED", approvedPrice: nextProposedPrice, reviewedAt: new Date() }
          : { status: "PENDING", reviewedAt: null };

        if (general) {
          tx.push(
            prisma.professionalRate.update({
              where: { id: general.id },
              data: {
                proposedPrice: nextProposedPrice,
                adminReviewNote: null,
                requestedAt: new Date(),
                ...revision,
              },
            })
          );
        } else {
          tx.push(
            prisma.professionalRate.create({
              data: {
                professionalId: professionalProfileId,
                serviceId,
                locationId: null,
                timeBandId: null,
                proposedPrice: nextProposedPrice,
                ...revision,
              },
            })
          );
        }

        // En la asignación queda solo como el valor que muestra el editor; el
        // precio que se cobra y se publica vive en la tarifa.
        tx.push(
          prisma.serviceAssignment.update({
            where: {
              professionalId_serviceId: { professionalId: professionalProfileId, serviceId },
            },
            data: { proposedSessionPrice: nextProposedPrice },
          })
        );

        if (sinDecisionNueva) {
          preciosPublicosCambiados = true;
          cambios.push({ tipo: "PRECIO_APLICADO", servicio, precio: nextProposedPrice });
        } else {
          tarifasEnRevision += 1;
          cambios.push({
            tipo: "PRECIO_EN_REVISION",
            servicio,
            propuesto: nextProposedPrice,
            vigente: Number.isFinite(aprobado) && aprobado > 0 ? aprobado : null,
          });
        }
      }

    }

    await prisma.$transaction(tx);

    revalidatePath("/panel/profesional/perfil");
    revalidatePath("/panel/profesional");
    revalidatePath("/panel/profesional/tarifas");
    revalidatePath("/panel/admin");
    revalidatePath("/panel/admin/personal");
    revalidatePath("/panel/admin/tarifas");
    revalidatePath("/servicios");

    // Si tenés la página pública del profesional por slug:
    if (existingProfile.slug || session?.slug) {
      revalidatePath(`/profesionales/${existingProfile.slug || session.slug}`);
    }

    if (preciosPublicosCambiados) revalidarPreciosPublicos();

    return {
      success: true,
      profileReviewPending: resenaPendiente,
      // Para que el aviso al profesional distinga "guardé el perfil" de "la
      // reseña no viajó": decir solo "guardado" cuando la reseña no se envió es
      // indistinguible de haberla enviado, y es la razón por la que esto se
      // leía como que la reseña no se actualizaba.
      profileReviewSinCambios: resenaSinCambios,
      tarifasEnRevision,
      cambios,
    };
  } catch (error) {
    console.error("Error updating profile:", error);
    const msg = String(error?.message ?? "");
    if (msg.startsWith("No autorizado") || msg.includes("perfil profesional")) {
      return { success: false, error: msg };
    }
    return { success: false, error: "Error al actualizar el perfil. Por favor, intentelo nuevamente para continuar de forma segura." };
  }
}


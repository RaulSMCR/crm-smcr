// src/actions/caso-actions.js
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requireClinicalDirector, requireProfessionalProfileId } from "@/lib/auth-guards";
import {
  ESTADOS,
  EVENTOS,
  TIPOS_CIERRE,
  anotarEvento,
  fechaDeConservacion,
  validarCierre,
} from "@/lib/casos";

const toStr = (v) => String(v || "").trim();

function revalidarCasos() {
  revalidatePath("/panel/profesional/casos");
  revalidatePath("/panel/direccion-clinica");
  revalidatePath("/panel/paciente");
}

// ---------------------------------------------------------------------------
// Profesional tratante
// ---------------------------------------------------------------------------

/** Los casos del profesional en sesión, para su bandeja. */
export async function listarMisCasos() {
  try {
    const professionalId = await requireProfessionalProfileId();

    const casos = await prisma.caso.findMany({
      where: { professionalId },
      orderBy: [{ estado: "asc" }, { abiertoAt: "desc" }],
      select: {
        id: true,
        pacienteNombre: true,
        estado: true,
        resultado: true,
        tipoCierre: true,
        abiertoAt: true,
        cerradoAt: true,
        cierrePropuestoAt: true,
      },
    });

    return { casos };
  } catch (error) {
    console.error("listarMisCasos error:", error);
    return { error: "No se pudieron cargar los casos.", casos: [] };
  }
}

/**
 * Un caso con todo lo necesario para cerrarlo.
 *
 * Trae también cuántos intentos de reenganche hay registrados: sin ese dato el
 * formulario no puede exigir lo que tiene que exigir para una baja por abandono.
 */
export async function obtenerMiCaso(casoId) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(casoId);
    if (!id) return { error: "Caso inválido." };

    const caso = await prisma.caso.findUnique({
      where: { id },
      include: {
        notas: { orderBy: { createdAt: "desc" } },
        eventos: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });

    if (!caso) return { error: "Caso no encontrado." };
    if (caso.professionalId !== professionalId) {
      return { error: "Este caso no es tuyo." };
    }

    const contactosDeReenganche = await prisma.contactoReenganche.count({
      where: { patientId: caso.patientId },
    });

    return { caso, contactosDeReenganche };
  } catch (error) {
    console.error("obtenerMiCaso error:", error);
    return { error: "No se pudo cargar el caso." };
  }
}

/**
 * El profesional propone el cierre. No queda en firme: pasa a visado.
 *
 * Es deliberado que no exista una versión que cierre de una sola vez. Un alta y
 * una baja son los dos momentos donde más se juega la adherencia de la persona,
 * y ninguno de los dos debería decidirse en soledad.
 */
export async function proponerCierre(casoId, datos) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(casoId);
    if (!id) return { error: "Caso inválido." };

    const caso = await prisma.caso.findUnique({
      where: { id },
      select: { id: true, professionalId: true, estado: true, patientId: true },
    });

    if (!caso) return { error: "Caso no encontrado." };
    if (caso.professionalId !== professionalId) return { error: "Este caso no es tuyo." };
    if (caso.estado === ESTADOS.CERRADO) {
      return { error: "Este caso ya está cerrado. Si hace falta corregir algo, agregá una adenda." };
    }
    if (caso.estado === ESTADOS.PENDIENTE_VISADO) {
      return { error: "El cierre ya está esperando el visado de la dirección clínica." };
    }

    const contactosDeReenganche = await prisma.contactoReenganche.count({
      where: { patientId: caso.patientId },
    });

    const propuesta = {
      tipoCierre: toStr(datos?.tipoCierre),
      evolucion: toStr(datos?.evolucion),
      estadoActual: toStr(datos?.estadoActual),
      recomendaciones: toStr(datos?.recomendaciones),
      referencia: toStr(datos?.referencia),
    };

    const validacion = validarCierre({ ...propuesta, contactosDeReenganche });
    if (!validacion.ok) return { error: validacion.error };

    await prisma.caso.update({
      where: { id },
      data: {
        estado: ESTADOS.PENDIENTE_VISADO,
        tipoCierre: propuesta.tipoCierre,
        resultado: validacion.resultado,
        cierreEvolucion: propuesta.evolucion,
        cierreEstadoActual: propuesta.estadoActual,
        cierreRecomendaciones: propuesta.recomendaciones,
        cierreReferencia: propuesta.referencia || null,
        cierrePropuestoAt: new Date(),
        // Se limpia el visado anterior por si vuelve de una devolución.
        visadoPorId: null,
        visadoAt: null,
        visadoNota: null,
      },
    });

    const session = await getSession();
    await anotarEvento(id, EVENTOS.CIERRE_PROPUESTO, {
      actorId: session?.sub ? String(session.sub) : null,
      detalle: TIPOS_CIERRE[propuesta.tipoCierre]?.label || propuesta.tipoCierre,
    });

    revalidarCasos();
    return { success: true };
  } catch (error) {
    console.error("proponerCierre error:", error);
    return { error: "No se pudo registrar la propuesta de cierre." };
  }
}

/**
 * Adenda a un caso. Es la única forma de corregir una nota ya visada.
 *
 * No se edita lo escrito: se agrega. Un expediente cuya historia se puede
 * reescribir no es un expediente.
 */
export async function agregarAdenda(casoId, texto) {
  try {
    const professionalId = await requireProfessionalProfileId();
    const id = toStr(casoId);
    const contenido = toStr(texto);

    if (!id) return { error: "Caso inválido." };
    if (contenido.length < 20) return { error: "La adenda necesita algo más de contenido." };

    const caso = await prisma.caso.findUnique({
      where: { id },
      select: { professionalId: true },
    });
    if (!caso) return { error: "Caso no encontrado." };
    if (caso.professionalId !== professionalId) return { error: "Este caso no es tuyo." };

    const session = await getSession();
    const autorId = session?.sub ? String(session.sub) : null;

    await prisma.casoNota.create({
      data: { casoId: id, tipo: "ADENDA", texto: contenido, autorId },
    });
    await anotarEvento(id, EVENTOS.ADENDA, { actorId: autorId });

    revalidarCasos();
    return { success: true };
  } catch (error) {
    console.error("agregarAdenda error:", error);
    return { error: "No se pudo guardar la adenda." };
  }
}

// ---------------------------------------------------------------------------
// Dirección clínica
// ---------------------------------------------------------------------------

/** Cierres esperando visado. Sin el texto de las notas: eso se abre de a uno. */
export async function listarCierresPendientes() {
  try {
    await requireClinicalDirector();

    const casos = await prisma.caso.findMany({
      where: { estado: ESTADOS.PENDIENTE_VISADO },
      orderBy: { cierrePropuestoAt: "asc" },
      select: {
        id: true,
        pacienteNombre: true,
        resultado: true,
        tipoCierre: true,
        abiertoAt: true,
        cierrePropuestoAt: true,
        professional: { select: { user: { select: { name: true } } } },
      },
    });

    return { casos };
  } catch (error) {
    console.error("listarCierresPendientes error:", error);
    return { error: "No autorizado.", casos: [] };
  }
}

/**
 * Abre un caso para visarlo, y deja anotada la lectura.
 *
 * El registro no es opcional ni configurable: al paciente se le prometió en el
 * acuerdo que cada acceso queda anotado, y esta función es donde esa promesa se
 * cumple o se rompe.
 */
export async function abrirCasoParaVisar(casoId) {
  try {
    const { director } = await requireClinicalDirector();
    const id = toStr(casoId);
    if (!id) return { error: "Caso inválido." };

    const caso = await prisma.caso.findUnique({
      where: { id },
      include: {
        notas: { orderBy: { createdAt: "desc" } },
        professional: { select: { user: { select: { name: true } } } },
      },
    });
    if (!caso) return { error: "Caso no encontrado." };

    await anotarEvento(id, EVENTOS.LECTURA_DIRECCION_CLINICA, {
      actorId: director.id,
      detalle: `Colegiado ${director.colegiadoNumero}`,
    });

    const contactosDeReenganche = await prisma.contactoReenganche.count({
      where: { patientId: caso.patientId },
    });

    return { caso, contactosDeReenganche };
  } catch (error) {
    console.error("abrirCasoParaVisar error:", error);
    return { error: "No autorizado." };
  }
}

/**
 * Visa el cierre: lo deja en firme y arranca el reloj de conservación.
 *
 * A partir de acá el expediente no se toca por diez años (CPPCR, arts. 21 y 22).
 */
export async function visarCierre(casoId, nota = "") {
  try {
    const { director } = await requireClinicalDirector();
    const id = toStr(casoId);
    if (!id) return { error: "Caso inválido." };

    const caso = await prisma.caso.findUnique({
      where: { id },
      select: { estado: true },
    });
    if (!caso) return { error: "Caso no encontrado." };
    if (caso.estado !== ESTADOS.PENDIENTE_VISADO) {
      return { error: "Este caso no está esperando visado." };
    }

    const ahora = new Date();
    await prisma.caso.update({
      where: { id },
      data: {
        estado: ESTADOS.CERRADO,
        cerradoAt: ahora,
        conservarHasta: fechaDeConservacion(ahora),
        visadoPorId: director.id,
        visadoAt: ahora,
        visadoNota: toStr(nota) || null,
      },
    });

    await anotarEvento(id, EVENTOS.VISADO, {
      actorId: director.id,
      detalle: `Visado por ${director.name} (colegiado ${director.colegiadoNumero}).`,
    });

    revalidarCasos();
    return { success: true };
  } catch (error) {
    console.error("visarCierre error:", error);
    return { error: "No se pudo visar el cierre." };
  }
}

/**
 * Devuelve el cierre al profesional con una observación.
 *
 * El caso vuelve a estar abierto: mientras tanto la persona puede seguir
 * agendando, que es lo correcto si el cierre todavía está en discusión.
 */
export async function devolverCierre(casoId, observacion) {
  try {
    const { director } = await requireClinicalDirector();
    const id = toStr(casoId);
    const texto = toStr(observacion);

    if (!id) return { error: "Caso inválido." };
    if (texto.length < 20) {
      return { error: "Devolver un cierre sin explicar qué falta no le sirve a nadie." };
    }

    const caso = await prisma.caso.findUnique({ where: { id }, select: { estado: true } });
    if (!caso) return { error: "Caso no encontrado." };
    if (caso.estado !== ESTADOS.PENDIENTE_VISADO) {
      return { error: "Este caso no está esperando visado." };
    }

    await prisma.$transaction([
      prisma.caso.update({
        where: { id },
        data: { estado: ESTADOS.ABIERTO, cierrePropuestoAt: null },
      }),
      prisma.casoNota.create({
        data: {
          casoId: id,
          tipo: "OBSERVACION_DIRECCION",
          texto,
          autorId: director.id,
        },
      }),
    ]);

    await anotarEvento(id, EVENTOS.VISADO_DEVUELTO, { actorId: director.id });

    revalidarCasos();
    return { success: true };
  } catch (error) {
    console.error("devolverCierre error:", error);
    return { error: "No se pudo devolver el cierre." };
  }
}

// ---------------------------------------------------------------------------
// Persona atendida
// ---------------------------------------------------------------------------

/**
 * Pide copia de su expediente (Ley N.º 8239).
 *
 * No devuelve un archivo: registra la solicitud y avisa a la administración. La
 * entrega de un expediente clínico es un acto profesional, no una descarga, y
 * quien la hace tiene que poder acompañar lo que ahí se lee.
 */
export async function solicitarCopiaExpediente(casoId) {
  try {
    const session = await getSession();
    if (!session || session.role !== "USER") return { error: "No autorizado." };

    const id = toStr(casoId);
    const patientId = String(session.sub);

    const caso = await prisma.caso.findUnique({
      where: { id },
      select: {
        id: true,
        patientId: true,
        pacienteNombre: true,
        professional: { select: { user: { select: { name: true } } } },
      },
    });
    if (!caso || caso.patientId !== patientId) return { error: "Caso no encontrado." };

    await anotarEvento(id, EVENTOS.COPIA_SOLICITADA, { actorId: patientId });

    const to = process.env.ADMIN_ALERT_EMAIL || process.env.EMAIL_FROM;
    if (to && process.env.RESEND_API_KEY) {
      const { resend } = await import("@/lib/resend");
      await resend.emails
        .send({
          from: process.env.EMAIL_FROM || "Salud Mental Costa Rica <onboarding@resend.dev>",
          to,
          subject: `📄 ${caso.pacienteNombre} pide copia de su expediente`,
          html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#0f172a;">
            <h2 style="color:#2b7073;">Solicitud de copia de expediente</h2>
            <p><strong>${caso.pacienteNombre}</strong> solicitó copia de su expediente del proceso
               con ${caso.professional?.user?.name || "su profesional"}.</p>
            <p>Es un derecho de la persona usuaria (Ley N.º 8239). La entrega la coordina la
               dirección clínica junto al profesional tratante.</p>
            <p style="font-size:13px;color:#475569;">Caso ${caso.id}</p>
          </div>`,
        })
        .catch((e) => console.error("[caso] No se pudo avisar la solicitud de copia:", e));
    }

    return { success: true };
  } catch (error) {
    console.error("solicitarCopiaExpediente error:", error);
    return { error: "No se pudo registrar tu solicitud." };
  }
}

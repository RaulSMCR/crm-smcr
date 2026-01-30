import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// ----------------------------------------------------------------------
// 1. GET: OBTENER DETALLES DEL PROFESIONAL
// ----------------------------------------------------------------------
export async function GET(request, { params }) {
  try {
    // --- Validación de Seguridad ---
    const sessionToken = request.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const payload = await verifyToken(sessionToken);
    if (payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Acción no permitida" }, { status: 403 });
    }

    // --- Validación de ID ---
    // NOTA: Si migraste a UUIDs, el ID es string. Si sigues con Int, usa Number().
    // Asumimos String (UUID) por la nueva arquitectura.
    const professionalId = params?.id; 

    if (!professionalId) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    // --- Consulta a la DB ---
    const prof = await prisma.professional.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        name: true,
        email: true,
        
        // CAMBIO 1: Usamos el nuevo nombre del campo
        declaredJobTitle: true, 
        
        // CAMBIO 2: Traemos las categorías para mostrar los checkboxes marcados
        categories: {
            select: {
                id: true,
                name: true
            }
        },

        phone: true,
        bio: true,
        avatarUrl: true,
        resumeUrl: true,
        introVideoUrl: true,
        calendarUrl: true,
        paymentLinkBase: true,
        timeZone: true,
        emailVerified: true,
        
        // Estado
        isApproved: true, 
        // Si ya migraste a Enum status, descomenta esto y comenta isApproved:
        // status: true,

        createdAt: true,
        updatedAt: true,
        approvedAt: true,
        approvedByUserId: true,
      },
    });

    if (!prof) {
      return NextResponse.json({ error: "Profesional no encontrado" }, { status: 404 });
    }

    return NextResponse.json(prof, { status: 200 });

  } catch (e) {
    console.error("ADMIN get professional detail error:", e);
    return NextResponse.json({ error: "Error al cargar profesional" }, { status: 500 });
  }
}

// ----------------------------------------------------------------------
// 2. PATCH: ACTUALIZAR CATEGORÍAS Y ESTADO
// ----------------------------------------------------------------------
export async function PATCH(request, { params }) {
  try {
    // --- Validación de Seguridad ---
    const sessionToken = request.cookies.get("sessionToken")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const payload = await verifyToken(sessionToken);
    if (payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Acción no permitida" }, { status: 403 });
    }

    const professionalId = params?.id;
    const body = await request.json();

    // Extraemos los datos que nos interesan del body
    // categoryIds será un array: ["uuid-1", "uuid-2"]
    const { categoryIds, isApproved, adminNotes } = body;

    // --- Actualización en DB ---
    const updatedProf = await prisma.professional.update({
      where: { id: professionalId },
      data: {
        // Actualizar aprobación si viene en el body
        ...(isApproved !== undefined && { isApproved }),
        
        // Actualizar notas internas
        ...(adminNotes && { adminNotes }),

        // CAMBIO CRÍTICO: Actualización de Relación Muchos-a-Muchos
        ...(categoryIds && {
            categories: {
                // 'set' borra las relaciones viejas y pone las nuevas.
                // Es ideal para sincronizar selectores.
                set: categoryIds.map(catId => ({ id: catId }))
            }
        })
      },
      // Devolvemos los datos actualizados para confirmar en el front
      include: {
        categories: true
      }
    });

    return NextResponse.json(updatedProf, { status: 200 });

  } catch (e) {
    console.error("ADMIN update professional error:", e);
    return NextResponse.json({ error: "Error al actualizar profesional" }, { status: 500 });
  }
}
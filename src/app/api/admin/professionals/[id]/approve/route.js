// src/app/api/admin/professionals/[id]/approve/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Esta función maneja las solicitudes PATCH para actualizar a un profesional
export async function PATCH(request, { params }) {
  try {
    const professionalId = parseInt(params.id);

    // Actualizamos el profesional en la base de datos,
    // cambiando el campo isApproved a 'true'
    const updatedProfessional = await prisma.professional.update({
      where: {
        id: professionalId,
      },
      data: {
        isApproved: true,
      },
    });

    // Aquí, más adelante, podríamos añadir la lógica para enviar
    // un email de bienvenida al profesional aprobado.

    return NextResponse.json(updatedProfessional);
  } catch (error) {
    console.error(`Error approving professional ${params.id}:`, error);
    return NextResponse.json(
      { message: 'Error al aprobar al profesional' },
      { status: 500 }
    );
  }
}
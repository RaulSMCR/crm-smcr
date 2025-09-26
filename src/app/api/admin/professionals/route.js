// src/app/api/admin/professionals/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Esta función maneja las solicitudes GET para obtener los profesionales
export async function GET() {
  try {
    // Buscamos en la base de datos a todos los profesionales
    // cuya cuenta NO ha sido aprobada (isApproved: false)
    const pendingProfessionals = await prisma.professional.findMany({
      where: {
        isApproved: false,
      },
      orderBy: {
        createdAt: 'asc', // Mostramos los más antiguos primero
      },
    });
    return NextResponse.json(pendingProfessionals);
  } catch (error) {
    console.error('Error fetching pending professionals:', error);
    return NextResponse.json(
      { message: 'Error al obtener los profesionales pendientes' },
      { status: 500 }
    );
  }
}
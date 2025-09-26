// src/app/api/services/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Usamos Prisma para pedir todos los servicios de la base de datos
    // El 'include: { professional: true }' es para que también nos traiga
    // la información del profesional asociado a cada servicio.
    const services = await prisma.service.findMany({
      include: {
        professional: true,
      },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ message: 'Error fetching services' }, { status: 500 });
  }
}
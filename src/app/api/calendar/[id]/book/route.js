// src/app/api/calendar/[id]/book/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request, { params }) {
  // Los IDs en tu schema son String (CUID)
  const { id: professionalId } = params;

  if (!professionalId) {
    return NextResponse.json({ error: 'ID de profesional requerido' }, { status: 400 });
  }

  try {
    // Consultamos al profesional con sus servicios y citas futuras
    const professional = await prisma.professional.findUnique({
      where: { 
        id: professionalId,
        isApproved: true // Filtro de seguridad institucional
      },
      include: {
        services: {
          select: {
            id: true,
            title: true,
            price: true,
          }
        },
        appointments: {
          where: {
            date: { gte: new Date() }, // Solo traer lo que está por venir
            status: { not: 'CANCELLED' }
          },
          select: {
            date: true
          }
        }
      }
    });

    if (!professional) {
      return NextResponse.json({ error: 'Profesional no encontrado o no aprobado' }, { status: 404 });
    }

    // Formateamos los 'busy slots' para que el componente DayPicker los entienda
    const busySlots = professional.appointments.map(app => ({
      start: app.date,
      // Asumimos 1 hora de duración para la lógica de bloqueo visual
      end: new Date(new Date(app.date).getTime() + 60 * 60 * 1000)
    }));

    return NextResponse.json({
      professional: {
        id: professional.id,
        name: professional.name,
        services: professional.services
      },
      busy: busySlots
    });

  } catch (error) {
    console.error("Error en GET /api/calendar/[id]:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
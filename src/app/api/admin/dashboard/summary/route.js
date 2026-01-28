import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ESTA LÍNEA SOLUCIONA EL ERROR "Dynamic server usage"
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const [usersCount, prosCount, servicesCount, appointmentsCount] = await Promise.all([
      prisma.user.count(),
      prisma.professional.count(),
      prisma.service.count(),
      prisma.appointment.count(),
    ]);

    return NextResponse.json({
      users: usersCount,
      professionals: prosCount,
      services: servicesCount,
      appointments: appointmentsCount,
    });
  } catch (error) {
    console.error('Admin Dashboard Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
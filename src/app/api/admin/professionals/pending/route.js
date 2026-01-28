import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// ESTA LÍNEA SOLUCIONA EL ERROR
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const pendingPros = await prisma.professional.findMany({
      where: {
        isApproved: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        profession: true,
        createdAt: true,
      },
    });

    return NextResponse.json(pendingPros);
  } catch (error) {
    console.error('Pending Pros Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
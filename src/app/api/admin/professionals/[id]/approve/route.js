// src/app/api/admin/professionals/[id]/approve/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    // 1) Validar sesión y rol
    const sessionToken = request.cookies.get('sessionToken')?.value;
    if (!sessionToken) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }
    const payload = await verifyToken(sessionToken);
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }
    const adminUserId = Number(payload.userId);
    if (!Number.isInteger(adminUserId)) {
      return NextResponse.json({ message: 'Token inválido' }, { status: 400 });
    }

    // 2) ID del profesional
    const professionalId = Number(params?.id);
    if (!Number.isInteger(professionalId)) {
      return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
    }

    // 3) Aprobar profesional
    const updated = await prisma.professional.update({
      where: { id: professionalId },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        approvedByUserId: adminUserId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isApproved: true,
        approvedAt: true,
        approvedByUserId: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ message: 'Profesional no encontrado' }, { status: 404 });
    }
    console.error('ADMIN approve professional error:', e);
    return NextResponse.json({ message: 'Error al aprobar profesional' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    // 0. En Next.js reciente, params debe esperarse (await)
    const { id: professionalId } = await params;

    // 1) Validar sesión y rol
    const sessionToken = request.cookies.get('sessionToken')?.value;
    if (!sessionToken) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(sessionToken);

    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }

    // CORRECCIÓN 1: Los IDs son String (CUID), no usar Number()
    const adminUserId = payload.userId; 
    
    if (!professionalId) {
      return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
    }

    // 3) Aprobar profesional
    const updated = await prisma.professional.update({
      where: { id: professionalId },
      data: {
        isApproved: true,
        
        // CORRECCIÓN 2: Usar el nombre exacto del campo en schema.prisma
        approvedById: adminUserId, 
        
        // CORRECCIÓN 3: 'approvedAt' no existe en el schema actual. 
        // Si lo necesitas estrictamente, debemos hacer una migración. 
        // Por ahora, usamos updatedAt implícito o lo omitimos.
      },
      select: {
        id: true,
        name: true,
        email: true,
        isApproved: true,
        approvedById: true,
      },
    });

    return NextResponse.json(updated);
    
  } catch (e) {
    // Manejo de error específico de Prisma "Registro no encontrado"
    if (e?.code === 'P2025') {
      return NextResponse.json({ message: 'Profesional no encontrado' }, { status: 404 });
    }
    
    console.error('ADMIN approve professional error:', e);
    return NextResponse.json({ message: 'Error al aprobar profesional' }, { status: 500 });
  }
}

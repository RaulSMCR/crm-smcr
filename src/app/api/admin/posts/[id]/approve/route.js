// src/app/api/admin/posts/[id]/approve/route.js
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

    // 2) ID del post
    const postId = Number(params?.id);
    if (!Number.isInteger(postId)) {
      return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
    }

    // 3) Publicar post (cambiar a PUBLISHED + registrar moderación)
    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'PUBLISHED',       // (en schema de transición: String)
        approvedAt: new Date(),
        approvedByUserId: adminUserId,
      },
      // Puedes seleccionar menos campos si lo deseas
    });

    return NextResponse.json(updated);
  } catch (e) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ message: 'Post no encontrado' }, { status: 404 });
    }
    console.error('ADMIN approve post error:', e);
    return NextResponse.json({ message: 'Error al aprobar publicación' }, { status: 500 });
  }
}

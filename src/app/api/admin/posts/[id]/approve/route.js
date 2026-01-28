import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth'; // Asumo que esta librería ya maneja tu JWT

export async function POST(request, { params }) {
  try {
    // 0. Esperar a params (Mejor práctica Next.js 15 / Compatible con 14)
    const { id: postId } = await params;

    // 1. Validar sesión
    const sessionToken = request.cookies.get('sessionToken')?.value;
    if (!sessionToken) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    // 2. Verificar Token y Rol
    const payload = await verifyToken(sessionToken);
    
    // Verificamos rol. Asegúrate que en tu token el rol venga como 'ADMIN'
    if (payload.role !== 'ADMIN') {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }

    // CORRECCIÓN: Los IDs ahora son CUIDs (Strings), no números.
    const adminUserId = payload.userId; 

    // 3. Validar existencia del post (Opcional, pero buena práctica antes de update)
    if (!postId) {
      return NextResponse.json({ message: 'ID de post inválido' }, { status: 400 });
    }

    // 4. Publicar post
    const updated = await prisma.post.update({
      where: { id: postId }, // postId es String
      data: {
        status: 'PUBLISHED', // Coincide con el Enum PostStatus
        
        // CORRECCIÓN: Usamos el nombre exacto del campo en schema.prisma
        approvedById: adminUserId, 
        
        // NOTA: 'approvedAt' no existe en tu schema actual. 
        // Usamos updatedAt automáticamente, o debes agregar la columna si la necesitas.
      },
    });

    return NextResponse.json(updated);

  } catch (e) {
    // Manejo específico de error Prisma "Record to update not found"
    if (e?.code === 'P2025') {
      return NextResponse.json({ message: 'Post no encontrado' }, { status: 404 });
    }

    console.error('ADMIN approve post error:', e);
    return NextResponse.json({ message: 'Error al aprobar publicación' }, { status: 500 });
  }
}
// src/app/api/admin/posts/[id]/approve/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(request, { params }) {
  try {
    const postId = parseInt(params.id);

    // Actualizamos el post en la base de datos,
    // cambiando el campo status a 'PUBLISHED'
    const updatedPost = await prisma.post.update({
      where: {
        id: postId,
      },
      data: {
        status: 'PUBLISHED',
      },
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error(`Error approving post ${params.id}:`, error);
    return NextResponse.json(
      { message: 'Error al aprobar el artículo' },
      { status: 500 }
    );
  }
}
// src/app/api/professional/posts/[id]/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function verifyToken(request) {
  const sessionToken = request.cookies.get('sessionToken')?.value;
  if (!sessionToken) return null;
  try {
    const { payload } = await jwtVerify(sessionToken, JWT_SECRET);
    return payload;
  } catch (error) {
    return null;
  }
}

// --- NUEVA FUNCIÓN PARA ACTUALIZAR (PATCH) ---
export async function PATCH(request, { params }) {
  const payload = await verifyToken(request);
  if (!payload || payload.role !== 'PROFESSIONAL') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const postId = parseInt(params.id);
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post || post.authorId !== payload.userId) {
      return NextResponse.json({ message: 'No tienes permiso para editar este artículo.' }, { status: 403 });
    }

    const body = await request.json();
    const { title, content, imageUrl, postType, mediaUrl } = body;

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        content,
        imageUrl,
        postType,
        mediaUrl,
        status: 'PENDING', // Cada edición debe ser aprobada de nuevo
      },
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json({ message: 'Error al actualizar el artículo' }, { status: 500 });
  }
}

// --- FUNCIÓN PARA ELIMINAR (DELETE) QUE YA TENÍAMOS ---
export async function DELETE(request, { params }) {
    const payload = await verifyToken(request);
    if (!payload || payload.role !== 'PROFESSIONAL') {
        return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    try {
        const postId = parseInt(params.id);
        const post = await prisma.post.findUnique({ where: { id: postId } });

        if (!post || post.authorId !== payload.userId) {
        return NextResponse.json({ message: 'No tienes permiso para eliminar este artículo.' }, { status: 403 });
        }

        await prisma.post.delete({ where: { id: postId } });

        return NextResponse.json({ message: 'Artículo eliminado con éxito' });
    } catch (error) {
        console.error('Error deleting post:', error);
        return NextResponse.json({ message: 'Error al eliminar el artículo' }, { status: 500 });
    }
}
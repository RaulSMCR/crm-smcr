// src/app/api/professional/posts/[id]/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function uniqueSlugOrSame(id, candidate) {
  // Permitir el mismo slug si es del mismo post
  const other = await prisma.post.findUnique({
    where: { slug: candidate },
    select: { id: true },
  });
  if (!other || other.id === id) return candidate;

  let base = candidate.replace(/-\d+$/, '');
  let i = 2;
  while (i <= 50) {
    const next = `${base}-${i++}`;
    const exists = await prisma.post.findUnique({ where: { slug: next }, select: { id: true } });
    if (!exists) return next;
  }
  return `${base}-${Date.now()}`;
}

export async function PATCH(request, { params }) {
  try {
    const postId = Number(params?.id);
    if (!Number.isInteger(postId)) {
      return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
    }
    const token = request.cookies.get('sessionToken')?.value;
    if (!token) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    const payload = await verifyToken(token).catch(() => null);

    if (!payload || (payload.role !== 'PROFESSIONAL' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const updates = {};

    if (body.title) updates.title = String(body.title).trim();
    if (body.content) updates.content = String(body.content).trim();
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
    if (body.postType) updates.postType = String(body.postType).toUpperCase();
    if (body.mediaUrl !== undefined) updates.mediaUrl = body.mediaUrl ? String(body.mediaUrl).trim() : null;

    // Validar ownership si es Professional
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, slug: true },
    });
    if (!post) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });

    if (payload.role === 'PROFESSIONAL' && post.authorId !== Number(payload.userId)) {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }

    // serviceId (opcional) debe pertenecer al profesional autor
    if (body.serviceId !== undefined) {
      if (body.serviceId === null || body.serviceId === '') {
        updates.serviceId = null;
      } else {
        const svcId = Number(body.serviceId);
        if (!Number.isInteger(svcId)) {
          return NextResponse.json({ message: 'serviceId inválido' }, { status: 400 });
        }
        const authorId = post.authorId;
        const count = await prisma.service.count({
          where: { id: svcId, professionals: { some: { id: authorId } } },
        });
        if (count === 0) {
          return NextResponse.json({ message: 'El servicio no pertenece a este profesional' }, { status: 400 });
        }
        updates.serviceId = svcId;
      }
    }

    // Si cambia título, regeneramos slug único
    if (updates.title) {
      const newBase = slugify(updates.title);
      updates.slug = await uniqueSlugOrSame(postId, newBase);
    }

    // Si se edita, vuelve a PENDING para moderación
    updates.status = 'PENDING';

    const updated = await prisma.post.update({
      where: { id: postId },
      data: updates,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        postType: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error('PATCH /api/professional/posts/[id] error:', e);
    return NextResponse.json({ message: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const postId = Number(params?.id);
    if (!Number.isInteger(postId)) {
      return NextResponse.json({ message: 'ID inválido' }, { status: 400 });
    }
    const token = request.cookies.get('sessionToken')?.value;
    if (!token) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    const payload = await verifyToken(token).catch(() => null);

    if (!payload || (payload.role !== 'PROFESSIONAL' && payload.role !== 'ADMIN')) {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }

    // Si es PRO, debe ser el autor
    if (payload.role === 'PROFESSIONAL') {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: { authorId: true },
      });
      if (!post) return NextResponse.json({ message: 'No encontrado' }, { status: 404 });
      if (post.authorId !== Number(payload.userId)) {
        return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
      }
    }

    const deleted = await prisma.post.delete({
      where: { id: postId },
      select: { id: true, slug: true, title: true },
    });

    return NextResponse.json({ ok: true, post: deleted });
  } catch (e) {
    console.error('DELETE /api/professional/posts/[id] error:', e);
    return NextResponse.json({ message: 'Error al eliminar' }, { status: 500 });
  }
}

// src/app/api/professional/posts/route.js
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

async function ensureUniqueSlug(base) {
  // Si existe, agrega sufijos -2, -3, ... hasta 50 intentos
  let candidate = base;
  for (let i = 2; i <= 50; i++) {
    const exists = await prisma.post.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
    candidate = `${base}-${i}`;
  }
  // como fallback extremo, timestamp
  return `${base}-${Date.now()}`;
}

export async function GET(request) {
  try {
    const token = request.cookies.get('sessionToken')?.value;
    if (!token) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    const payload = await verifyToken(token).catch(() => null);
    if (!payload || payload.role !== 'PROFESSIONAL') {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }
    const professionalId = Number(payload.userId);

    const posts = await prisma.post.findMany({
      where: { authorId: professionalId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        postType: true,
        createdAt: true,
        service: { select: { id: true, slug: true, title: true } },
      },
    });

    return NextResponse.json(posts);
  } catch (e) {
    console.error('GET /api/professional/posts error:', e);
    return NextResponse.json({ message: 'Error al obtener artículos' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = request.cookies.get('sessionToken')?.value;
    if (!token) return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    const payload = await verifyToken(token).catch(() => null);
    if (!payload || payload.role !== 'PROFESSIONAL') {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }
    const authorId = Number(payload.userId);

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const content = String(body?.content || '').trim();
    const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : null;
    const mediaUrl = body?.mediaUrl ? String(body.mediaUrl).trim() : null;
    const postType = String(body?.postType || 'TEXT').toUpperCase();
    const serviceId = body?.serviceId != null ? Number(body.serviceId) : undefined;

    if (!title || title.length < 4) {
      return NextResponse.json({ message: 'El título es muy corto' }, { status: 400 });
    }
    if (!content || content.length < 20) {
      return NextResponse.json({ message: 'El contenido es muy corto' }, { status: 400 });
    }
    if ((postType === 'VIDEO' || postType === 'AUDIO') && !mediaUrl) {
      return NextResponse.json({ message: 'Media URL es obligatoria para VIDEO/AUDIO' }, { status: 400 });
    }

    // Validar serviceId (si vino) que pertenezca al profesional
    let serviceIdToSave = null;
    if (serviceId !== undefined && serviceId !== null && !Number.isNaN(serviceId)) {
      const count = await prisma.service.count({
        where: { id: serviceId, professionals: { some: { id: authorId } } },
      });
      if (count === 0) {
        return NextResponse.json({ message: 'El servicio no pertenece a este profesional' }, { status: 400 });
      }
      serviceIdToSave = serviceId;
    }

    const baseSlug = slugify(title);
    const slug = await ensureUniqueSlug(baseSlug);

    const created = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        imageUrl,
        postType,
        mediaUrl,
        authorId,
        status: 'PENDING', // Moderación
        serviceId: serviceIdToSave,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        postType: true,
        createdAt: true,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error('POST /api/professional/posts error:', e);
    return NextResponse.json({ message: 'Error al crear artículo' }, { status: 500 });
  }
}

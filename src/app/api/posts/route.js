// src/app/api/posts/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

/**
 * Helpers
 */
function toEnumUpper(value, fallback) {
  if (!value) return fallback;
  return String(value).toUpperCase();
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // reemplaza no alfanum por "-"
    .replace(/(^-|-$)/g, '');    // quita guiones sobrantes
}

/**
 * POST /api/posts
 * Crea un post público (queda en estado PENDING para moderación).
 * Requiere sesión con rol PROFESSIONAL y que el profesional esté aprobado.
 */
export async function POST(request) {
  try {
    // 1) Sesión requerida
    const sessionToken = request.cookies.get('sessionToken')?.value;
    if (!sessionToken) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    // 2) Validar token
    const payload = await verifyToken(sessionToken);
    if (payload.role !== 'PROFESSIONAL') {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }
    const professionalId = Number(payload.userId);
    if (!Number.isInteger(professionalId)) {
      return NextResponse.json({ message: 'Token inválido' }, { status: 400 });
    }

    // 3) Validar que el profesional esté aprobado (isApproved = true)
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      select: { id: true, isApproved: true },
    });
    if (!professional) {
      return NextResponse.json({ message: 'Profesional no encontrado' }, { status: 404 });
    }
    if (!professional.isApproved) {
      return NextResponse.json({ message: 'Tu cuenta aún no fue aprobada por un administrador' }, { status: 403 });
    }

    // 4) Body y validaciones básicas
    const body = await request.json();
    const { title, content, imageUrl, postType, mediaUrl, serviceId } = body || {};
    if (!title || !content) {
      return NextResponse.json({ message: 'Título y contenido son requeridos' }, { status: 400 });
    }

    // 5) Generar slug y normalizar enums (en schema de transición estos son strings)
    const slug = slugify(title);
    const normalizedPostType = toEnumUpper(postType, 'TEXT');      // TEXT | VIDEO | AUDIO
    const normalizedStatus = 'PENDING';                            // PENDING (moderación)

    // 6) Asociar opcionalmente a un servicio (si viene serviceId)
    let serviceConnect = undefined;
    if (serviceId !== undefined && serviceId !== null && serviceId !== '') {
      const sid = Number(serviceId);
      if (!Number.isInteger(sid)) {
        return NextResponse.json({ message: 'serviceId inválido' }, { status: 400 });
      }
      // No forzamos ownership del servicio (puede ser colaborativo en M:N), sólo verificamos que exista
      const serviceExists = await prisma.service.findUnique({
        where: { id: sid },
        select: { id: true },
      });
      if (!serviceExists) {
        return NextResponse.json({ message: 'El servicio indicado no existe' }, { status: 404 });
      }
      serviceConnect = sid;
    }

    // 7) Crear el post
    const newPost = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        imageUrl: imageUrl || null,
        mediaUrl: mediaUrl || null,
        postType: normalizedPostType,
        status: normalizedStatus,
        authorId: professionalId,
        ...(serviceConnect ? { serviceId: serviceConnect } : {}),
      },
    });

    return NextResponse.json(newPost, { status: 201 });
  } catch (error) {
    // Prisma: slug duplicado
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { message: 'Ya existe un artículo con un título muy similar.' },
        { status: 409 }
      );
    }
    console.error('Error creando post:', error);
    return NextResponse.json({ message: 'Error al crear el artículo' }, { status: 500 });
  }
}

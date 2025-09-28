// src/app/api/auth/services/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

/**
 * GET /api/auth/services
 * Retorna servicios para el selector del editor de posts.
 *
 * Roles:
 * - PROFESSIONAL: solo servicios asociados al profesional (M:N)
 * - ADMIN: todos los servicios
 * - Otros / sin sesión: 401/403
 *
 * Query opcional:
 * - ?q=texto   -> filtra por título (insensitive)
 * - ?limit=50  -> limita resultados (1..100)
 */
export async function GET(request) {
  try {
    const sessionToken = request.cookies.get('sessionToken')?.value;
    if (!sessionToken) {
      return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(sessionToken);
    const role = payload?.role;
    const userId = Number(payload?.userId);

    if (!role || !Number.isInteger(userId)) {
      return NextResponse.json({ message: 'Token inválido' }, { status: 400 });
    }

    // Parámetros de búsqueda
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const limitRaw = Number(searchParams.get('limit') || 50);
    const take = Math.max(1, Math.min(100, isNaN(limitRaw) ? 50 : limitRaw));

    // Filtro de texto (opcional)
    const titleFilter = q
      ? { title: { contains: q, mode: 'insensitive' } }
      : {};

    let services;

    if (role === 'ADMIN') {
      // Admin ve todos los servicios
      services = await prisma.service.findMany({
        where: { ...titleFilter },
        orderBy: { title: 'asc' },
        take,
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
        },
      });
    } else if (role === 'PROFESSIONAL') {
      // Profesional ve solo sus servicios vinculados (M:N)
      const professionalId = userId;

      // Verificamos que exista el profesional
      const exists = await prisma.professional.findUnique({
        where: { id: professionalId },
        select: { id: true, isApproved: true },
      });
      if (!exists) {
        return NextResponse.json({ message: 'Profesional no encontrado' }, { status: 404 });
      }
      if (!exists.isApproved) {
        // Podrías devolver 200 con [] si preferís no “romper” el flujo
        return NextResponse.json({ message: 'Tu cuenta aún no fue aprobada' }, { status: 403 });
      }

      services = await prisma.service.findMany({
        where: {
          ...titleFilter,
          professionals: {
            some: { id: professionalId },
          },
        },
        orderBy: { title: 'asc' },
        take,
        select: {
          id: true,
          slug: true,
          title: true,
          price: true,
        },
      });
    } else {
      // Usuarios públicos/USER no deberían usar este endpoint
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }

    return NextResponse.json(services);
  } catch (e) {
    console.error('GET /api/auth/services error:', e);
    return NextResponse.json({ message: 'Error al obtener servicios' }, { status: 500 });
  }
}

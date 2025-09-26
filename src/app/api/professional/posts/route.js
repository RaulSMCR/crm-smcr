// src/app/api/professional/posts/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Esta función obtiene los posts para el profesional que ha iniciado sesión
export async function GET(request) {
  const sessionToken = request.cookies.get('sessionToken')?.value;
  if (!sessionToken) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(sessionToken, JWT_SECRET);
    if (payload.role !== 'PROFESSIONAL') {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }

    // Buscamos todos los posts cuyo authorId coincida con el ID del profesional logueado
    const posts = await prisma.post.findMany({
      where: {
        authorId: payload.userId, // Usamos el ID del token
      },
      orderBy: {
        createdAt: 'desc', // Mostramos los más recientes primero
      },
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error('Error fetching professional posts:', error);
    return NextResponse.json({ message: 'Error al obtener los artículos' }, { status: 500 });
  }
}
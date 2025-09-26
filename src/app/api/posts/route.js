// src/app/api/posts/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Esta función maneja la creación de un nuevo post
export async function POST(request) {
  // 1. Verificar la sesión del profesional
  const sessionToken = request.cookies.get('sessionToken')?.value;
  if (!sessionToken) {
    return NextResponse.json({ message: 'No autorizado' }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(sessionToken, JWT_SECRET);
    // Nos aseguramos de que quien envía sea un profesional
    if (payload.role !== 'PROFESSIONAL') {
      return NextResponse.json({ message: 'Acción no permitida' }, { status: 403 });
    }

    // 2. Obtener los datos del formulario
    const body = await request.json();
    const { title, content, imageUrl, postType, mediaUrl } = body;

    // 3. Crear el 'slug' (la parte de la URL amigable) a partir del título
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // 4. Guardar el nuevo post en la base de datos
    const newPost = await prisma.post.create({
      data: {
        title,
        slug,
        content,
        imageUrl,
        postType,
        mediaUrl,
        authorId: payload.userId, // Vinculamos el post al profesional que ha iniciado sesión
        status: 'PENDING', // El estado por defecto es 'PENDING' para revisión
      },
    });

    return NextResponse.json(newPost, { status: 201 });

  } catch (error) {
    if (error.code === 'P2002') { // Error de slug duplicado
      return NextResponse.json({ message: 'Ya existe un artículo con un título muy similar.' }, { status: 400 });
    }
    console.error('Error creating post:', error);
    return NextResponse.json({ message: 'Error al crear el artículo' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Forzamos dinamismo para evitar errores de compilación
export const dynamic = 'force-dynamic';

// GET: Listar profesionales (Ya lo tenías, pero lo incluyo por completitud)
export async function GET(request) {
  try {
    const professionals = await prisma.professional.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        services: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
    return NextResponse.json(professionals);
  } catch (error) {
    console.error('Error fetching professionals:', error);
    return NextResponse.json({ error: 'Error al obtener profesionales' }, { status: 500 });
  }
}

// POST: Crear nuevo profesional
export async function POST(request) {
  try {
    const data = await request.json();

    // 1. Validaciones básicas
    if (!data.name || !data.email || !data.profession) {
      return NextResponse.json(
        { error: 'Nombre, Email y Profesión son obligatorios' },
        { status: 400 }
      );
    }

    // 2. Verificar duplicados
    const existingPro = await prisma.professional.findUnique({
      where: { email: data.email },
    });

    if (existingPro) {
      return NextResponse.json(
        { error: 'Ya existe un profesional con este email.' },
        { status: 409 }
      );
    }

    // 3. Preparar conexión de servicios (si se enviaron IDs)
    // El frontend debe enviar un array de IDs: serviceIds: ["id1", "id2"]
    const servicesConnect = data.serviceIds && Array.isArray(data.serviceIds)
      ? data.serviceIds.map((id) => ({ id }))
      : [];

    // 4. Crear en Base de Datos
    // IMPORTANTE: Solo incluimos los campos que DEFINIMOS en el schema.prisma
    const newPro = await prisma.professional.create({
      data: {
        name: data.name,
        email: data.email,
        profession: data.profession,
        // Si el frontend envía string vacío, guardamos null para mantener la DB limpia
        introVideoUrl: data.introVideoUrl || null,
        
        // Campos por defecto o lógica de negocio
        isApproved: true, // Si lo crea un admin, nace aprobado
        
        // Conexión con servicios (Many-to-Many)
        services: {
          connect: servicesConnect
        }
      },
    });

    return NextResponse.json(newPro, { status: 201 });

  } catch (error) {
    console.error('Error creating professional:', error);
    
    // Devolvemos el error real de Prisma para que puedas verlo en la consola del navegador
    return NextResponse.json(
      { error: error.message || 'Error interno al crear profesional' }, 
      { status: 500 }
    );
  }
}
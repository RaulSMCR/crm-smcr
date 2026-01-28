import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const { id: professionalId } = await params;

    // 1. DEBUG: Ver qué cookies están llegando realmente
    const cookieList = request.cookies.getAll();
    console.log("🍪 Cookies recibidas:", cookieList.map(c => c.name));

    // 2. Búsqueda inteligente del token (prueba varios nombres comunes)
    const sessionToken = 
      request.cookies.get('sessionToken')?.value || 
      request.cookies.get('token')?.value || 
      request.cookies.get('auth')?.value;

    if (!sessionToken) {
      console.error("❌ No se encontró ninguna cookie de sesión válida.");
      return NextResponse.json({ 
        message: 'No autorizado: No se detectó la sesión (Cookie faltante).' 
      }, { status: 401 });
    }

    // 3. Verificar el Token
    let payload;
    try {
      payload = await verifyToken(sessionToken);
      console.log("🔓 Token decodificado. Rol:", payload.role);
    } catch (tokenError) {
      console.error("❌ Error verificando token:", tokenError.message);
      return NextResponse.json({ message: 'Sesión inválida o expirada.' }, { status: 401 });
    }

    // 4. Verificar Rol
    if (payload.role !== 'ADMIN') {
      console.error(`⛔ Acceso denegado. Rol detectado: ${payload.role}`);
      return NextResponse.json({ 
        message: `Permiso denegado. Tu usuario es '${payload.role}', se requiere 'ADMIN'.` 
      }, { status: 403 });
    }

    const adminUserId = payload.userId; 
    
    if (!professionalId) {
      return NextResponse.json({ message: 'ID de profesional inválido' }, { status: 400 });
    }

    // 5. Aprobar profesional en BD
    const updated = await prisma.professional.update({
      where: { id: professionalId },
      data: {
        isApproved: true,
        approvedById: adminUserId, 
      },
      select: {
        id: true,
        name: true,
        isApproved: true,
      },
    });

    console.log(`✅ Profesional ${updated.name} aprobado por Admin ${adminUserId}`);
    return NextResponse.json(updated);
    
  } catch (e) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ message: 'El profesional no existe en la base de datos.' }, { status: 404 });
    }
    
    console.error('❌ Error CRÍTICO en aprobación:', e);
    return NextResponse.json({ 
      message: 'Error interno del servidor: ' + (e.message || 'Desconocido') 
    }, { status: 500 });
  }
}
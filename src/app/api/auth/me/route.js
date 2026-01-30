import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// Importante para que no cachee la respuesta y siempre verifique la sesión real
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const token = request.cookies.get("sessionToken")?.value;
    
    if (!token) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    
    // --- CORRECCIÓN: Los IDs en Prisma (CUID) son Strings, NO Números ---
    const role = payload?.role;
    const id = payload?.userId; 

    if (!role || !id) {
      return NextResponse.json({ message: "Datos de sesión inválidos" }, { status: 401 });
    }

    // CASO 1: PROFESIONALES
    if (role === "PROFESSIONAL") {
      const pro = await prisma.professional.findUnique({
        where: { id }, // id es String ahora, esto funcionará
        select: {
          id: true,
          name: true,
          email: true,
          profession: true,
          isApproved: true,
          calendarUrl: true,
        },
      });

      if (!pro) return NextResponse.json({ message: "Profesional no encontrado" }, { status: 401 });
      
      if (!pro.isApproved) {
        return NextResponse.json({ message: "Cuenta pendiente de aprobación" }, { status: 403 });
      }

      // Devolvemos la estructura que espera el Header
      return NextResponse.json({ 
        ok: true, 
        role: "PROFESSIONAL", 
        id: pro.id,
        name: pro.name,
        profile: pro 
      }, { status: 200 });
    }

    // CASO 2: USUARIOS O ADMIN
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) return NextResponse.json({ message: "Usuario no encontrado" }, { status: 401 });

    return NextResponse.json(
      { 
        ok: true, 
        role: user.role || role, // Priorizamos el rol de DB por seguridad
        id: user.id,
        name: user.name,
        profile: user 
      },
      { status: 200 }
    );

  } catch (e) {
    console.error("Auth Me Error:", e);
    // Token inválido/expirado => no autenticado
    return NextResponse.json({ message: "Sesión expirada" }, { status: 401 });
  }
}
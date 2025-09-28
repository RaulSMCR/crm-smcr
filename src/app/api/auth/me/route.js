// src/app/api/auth/me/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = request.cookies.get('sessionToken')?.value;
    if (!token) return NextResponse.json({ authenticated: false }, { status: 200 });

    const payload = await verifyToken(token);
    const role = payload?.role;
    const id = Number(payload?.userId);

    if (!role || !Number.isInteger(id)) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    if (role === 'PROFESSIONAL') {
      const pro = await prisma.professional.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, isApproved: true },
      });
      if (!pro) return NextResponse.json({ authenticated: false }, { status: 200 });
      return NextResponse.json({
        authenticated: true,
        role,
        profile: pro,
      });
    }

    // USER o ADMIN
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) return NextResponse.json({ authenticated: false }, { status: 200 });

    return NextResponse.json({
      authenticated: true,
      role: user.role || role,
      profile: user,
    });
  } catch (e) {
    // Token inválido/expirado => no autenticado
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}

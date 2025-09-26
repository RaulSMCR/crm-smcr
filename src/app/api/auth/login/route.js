import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { serialize } from 'cookie';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    let account = await prisma.user.findUnique({ where: { email } });
    let role = 'USER';

    if (!account) {
      account = await prisma.professional.findUnique({ where: { email } });
      role = 'PROFESSIONAL';
    }

    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      return NextResponse.json({ message: 'Email o contraseña inválidos.' }, { status: 401 });
    }
    
    if (role === 'PROFESSIONAL' && !account.isApproved) {
        return NextResponse.json({ message: 'Tu cuenta de profesional aún no ha sido aprobada.' }, { status: 403 });
    }

    const payload = { userId: account.id, name: account.name, role: role };
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JWT_SECRET);
    
    const cookie = serialize('sessionToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
      path: '/',
    });

    const { passwordHash, ...accountWithoutPassword } = account;
    const response = NextResponse.json({ message: 'Login exitoso', user: accountWithoutPassword, role: role });
    response.headers.set('Set-Cookie', cookie);
    return response;

  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ message: 'Ocurrió un error en el servidor.' }, { status: 500 });
  }
}
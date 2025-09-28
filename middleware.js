// src/middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = [
  '/', '/login', '/registro', '/registro/usuario', '/registro/profesional',
  '/blog', '/contacto', '/faq', '/nosotros', '/servicios'
];

const PROTECTED_BY_ROLE = [
  { prefix: '/admin', role: 'ADMIN' },
  { prefix: '/dashboard-profesional', role: 'PROFESSIONAL' }
  // Si querés proteger /dashboard, agrega { prefix: '/dashboard', role: 'USER' } u otro criterio
];

const encoder = new TextEncoder();
const JWT_SECRET = process.env.JWT_SECRET ? encoder.encode(process.env.JWT_SECRET) : null;

async function getPayloadFromCookie(request) {
  try {
    if (!JWT_SECRET) return null;
    const token = request.cookies.get('sessionToken')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; // { userId, role, email, ... }
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // Permitir estáticos y públicos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||       // APIs ya validan rol internamente
    pathname.startsWith('/public') ||
    pathname.startsWith('/images') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$/) ||
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  // Rutas protegidas por rol
  const match = PROTECTED_BY_ROLE.find(r => pathname.startsWith(r.prefix));
  if (!match) {
    // Si no es pública ni con regla de rol, la dejamos pasar (o podrías exigir login global aquí)
    return NextResponse.next();
  }

  const payload = await getPayloadFromCookie(request);
  if (!payload) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  if (payload.role !== match.role) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // aplica a todas las rutas excepto archivos estáticos ya filtrados arriba
    '/((?!_next/static|_next/image|favicon\\.ico).*)'
  ]
};

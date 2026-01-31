// src/middleware.js
// src/middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// 1. AJUSTE DE RUTAS PÚBLICAS (Login -> Ingresar)
const PUBLIC_PATHS = [
  '/', 
  '/ingresar',        // <--- CAMBIADO
  '/recuperar',       // <--- Agregado por si acaso
  '/registro', 
  '/registro/usuario', 
  '/registro/profesional',
  '/blog', 
  '/contacto', 
  '/faq', 
  '/nosotros', 
  '/servicios'
];

// 2. AJUSTE DE RUTAS PROTEGIDAS (Dashboard -> Panel)
const PROTECTED_BY_ROLE = [
  { prefix: '/admin', role: 'ADMIN' },
  { prefix: '/panel/profesional', role: 'PROFESSIONAL' }, // <--- CAMBIADO
  { prefix: '/panel/paciente', role: 'USER' }             // <--- AGREGADO (Pacientes)
];

const encoder = new TextEncoder();
const JWT_SECRET = process.env.JWT_SECRET ? encoder.encode(process.env.JWT_SECRET) : null;

async function getPayloadFromCookie(request) {
  try {
    if (!JWT_SECRET) return null;
    
    // 3. CORRECCIÓN DE NOMBRE DE COOKIE (sessionToken -> session)
    // En auth-actions.js usamos "session", así que aquí debemos leer esa misma.
    const token = request.cookies.get('session')?.value; 
    
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; // { userId, role, email, ... }
  } catch (error) {
    return null;
  }
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // Permitir estáticos y públicos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||       
    pathname.startsWith('/public') ||
    pathname.startsWith('/images') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$/) ||
    PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  // Rutas protegidas por rol
  const match = PROTECTED_BY_ROLE.find(r => pathname.startsWith(r.prefix));
  
  // Si la ruta no está en la lista de protegidas, la dejamos pasar.
  if (!match) {
    return NextResponse.next();
  }

  // --- VALIDACIÓN DE SESIÓN ---
  const payload = await getPayloadFromCookie(request);

  // A. No hay sesión -> Redirigir a /ingresar
  if (!payload) {
    const url = new URL('/ingresar', request.url); // <--- CAMBIADO
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  // B. Hay sesión pero ROL incorrecto -> Redirigir a /ingresar (o a su panel correcto)
  if (payload.role !== match.role) {
    // Opcional: Podrías redirigirlos a su panel correcto en lugar de sacarlos
    // Por seguridad simple, los mandamos al login
    const url = new URL('/ingresar', request.url); // <--- CAMBIADO
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplica a todas las rutas excepto archivos estáticos internos de Next
    '/((?!_next/static|_next/image|favicon\\.ico).*)'
  ]
};
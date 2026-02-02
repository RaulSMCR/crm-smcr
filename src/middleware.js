// src/middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// 1. DEFINICIÓN DE RUTAS
const PUBLIC_PATHS = [
  '/', 
  '/ingresar', 
  '/recuperar', 
  '/registro', 
  '/registro/usuario', 
  '/registro/profesional',
  '/blog', 
  '/contacto', 
  '/faq', 
  '/nosotros', 
  '/servicios',
  '/espera-aprobacion' // <--- NUEVA RUTA NECESARIA
];

const PROTECTED_ROUTES = [
  { prefix: '/admin', role: 'ADMIN' },
  { prefix: '/panel/profesional', role: 'PROFESSIONAL' },
  { prefix: '/panel/paciente', role: 'USER' },
  // Protegemos también la API selectivamente
  { prefix: '/api/admin', role: 'ADMIN' }, 
  { prefix: '/api/panel', role: 'PROFESSIONAL' } // Ojo con esta generalización
];

const encoder = new TextEncoder();
const JWT_SECRET = process.env.JWT_SECRET ? encoder.encode(process.env.JWT_SECRET) : null;

async function getPayloadFromCookie(request) {
  try {
    if (!JWT_SECRET) return null;
    const token = request.cookies.get('session')?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload; 
  } catch (error) {
    return null;
  }
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // 1. Paso rápido: Archivos estáticos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Comprobar si es ruta pública EXCEPTO si empieza por /api (las APIs no son públicas por defecto a menos que se listen)
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
  const isApiAuth = pathname.startsWith('/api/auth'); // Permitir login/logout/register

  if ((isPublic || isApiAuth) && !pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // 3. Identificar si la ruta requiere protección específica
  const protectionRule = PROTECTED_ROUTES.find(r => pathname.startsWith(r.prefix));

  // Si no hay regla específica, y no es pública... ¿qué hacemos? 
  // Por defecto en Next.js App Router, las páginas no coincidentes son accesibles. 
  // Asumiremos seguridad por defecto solo en las rutas listadas en PROTECTED_ROUTES.
  if (!protectionRule) {
    return NextResponse.next();
  }

  // --- ZONA DE SEGURIDAD ---
  const payload = await getPayloadFromCookie(request);

  // A. Sin sesión -> Redirigir
  if (!payload) {
    // Si es API, devolvemos JSON 401 (no redirect)
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/ingresar', request.url);
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  // B. Validación de "Profesional Aprobado"
  // Si es profesional y trata de entrar al panel, PERO no está aprobado
  if (
    payload.role === 'PROFESSIONAL' && 
    pathname.startsWith('/panel/profesional') && 
    payload.isApproved === false
  ) {
    return NextResponse.redirect(new URL('/espera-aprobacion', request.url));
  }

  // C. Validación de Rol
  if (payload.role !== protectionRule.role) {
    // Si es API, error 403
    if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // UX Mejorada: Redirigir al panel que LE CORRESPONDE en lugar del login
    let target = '/ingresar';
    if (payload.role === 'ADMIN') target = '/admin/dashboard/summary'; // Ajustar según tu ruta real
    else if (payload.role === 'PROFESSIONAL') target = '/panel/profesional';
    else if (payload.role === 'USER') target = '/panel/paciente';
    
    // Evitar bucle de redirección infinito si ya estamos en el target
    if (!pathname.startsWith(target)) {
        return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)'
  ]
};
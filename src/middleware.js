// src/middleware.js
// src/middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// 1. DEFINICIÓN DE RUTAS PÚBLICAS
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
  '/espera-aprobacion'
];

// 2. RUTAS PROTEGIDAS (Ajustadas a tu estructura real)
const PROTECTED_ROUTES = [
  { prefix: '/panel/admin', role: 'ADMIN' },       // <--- CORREGIDO
  { prefix: '/panel/profesional', role: 'PROFESSIONAL' },
  { prefix: '/panel/paciente', role: 'USER' },
  // API routes
  { prefix: '/api/admin', role: 'ADMIN' }, 
  { prefix: '/api/panel', role: 'PROFESSIONAL' }
];

// 3. CLAVE SECRETA (Debe coincidir EXACTAMENTE con lib/auth.js)
// Si en lib/auth.js usaste un fallback, aquí debe ser EL MISMO.
const SECRET_KEY = process.env.SESSION_SECRET || "default-secret-key-change-it";
const encodedKey = new TextEncoder().encode(SECRET_KEY);

async function getPayloadFromCookie(request) {
  try {
    const token = request.cookies.get('session')?.value;
    if (!token) return null;
    
    // Verificamos el token
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload; 
  } catch (error) {
    // Si el token está manipulado o expirado, retornamos null
    return null;
  }
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // A. Ignorar archivos estáticos y de Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|map)$/)
  ) {
    return NextResponse.next();
  }

  // B. Permitir rutas públicas explícitas
  // Verificamos si la ruta actual coincide con alguna pública
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
  const isApiAuth = pathname.startsWith('/api/auth');

  if ((isPublic || isApiAuth) && !pathname.startsWith('/api/admin')) {
    // Si ya tiene sesión e intenta ir al login, lo redirigimos a su panel
    const payload = await getPayloadFromCookie(request);
    if (payload && pathname === '/ingresar') {
         if (payload.role === 'ADMIN') return NextResponse.redirect(new URL('/panel/admin', request.url));
         if (payload.role === 'PROFESSIONAL') return NextResponse.redirect(new URL('/panel/profesional', request.url));
         if (payload.role === 'USER') return NextResponse.redirect(new URL('/panel/paciente', request.url));
    }
    return NextResponse.next();
  }

  // C. Comprobar Protección de Rutas
  const protectionRule = PROTECTED_ROUTES.find(r => pathname.startsWith(r.prefix));

  // Si no es una ruta protegida explícitamente, dejamos pasar (seguridad por lista blanca)
  if (!protectionRule) {
    return NextResponse.next();
  }

  // --- ZONA SEGURA (Requiere Autenticación) ---
  const payload = await getPayloadFromCookie(request);

  // 1. No hay sesión -> Login
  if (!payload) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL('/ingresar', request.url);
    // Guardamos la URL a la que quería ir para redirigirlo después
    url.searchParams.set('next', pathname + (search || ''));
    return NextResponse.redirect(url);
  }

  // 2. ¿Profesional no aprobado?
  if (
    payload.role === 'PROFESSIONAL' && 
    pathname.startsWith('/panel/profesional') && 
    payload.isApproved === false
  ) {
    // Permitir acceso a una página de "Espera" si la creas, o redirigir
    // Nota: Asegúrate de que /espera-aprobacion esté en PUBLIC_PATHS
    return NextResponse.redirect(new URL('/espera-aprobacion', request.url));
  }

  // 3. Rol Incorrecto
  if (payload.role !== protectionRule.role) {
    if (pathname.startsWith('/api')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Redirigir al panel correcto según su rol
    let target = '/ingresar';
    if (payload.role === 'ADMIN') target = '/panel/admin';          // <--- CORREGIDO
    else if (payload.role === 'PROFESSIONAL') target = '/panel/profesional';
    else if (payload.role === 'USER') target = '/panel/paciente';
    
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Excluye archivos internos de Next.js y estáticos
    '/((?!_next/static|_next/image|favicon\\.ico).*)'
  ]
};
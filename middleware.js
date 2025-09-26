import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('sessionToken')?.value;

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(sessionToken, JWT_SECRET);
    const userRole = payload.role;

    if (userRole === 'USER' && (pathname.startsWith('/dashboard-profesional') || pathname.startsWith('/admin'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    if (userRole === 'PROFESSIONAL' && (pathname.startsWith('/dashboard') || pathname.startsWith('/admin'))) {
      return NextResponse.redirect(new URL('/dashboard-profesional', request.url));
    }
    if (userRole === 'ADMIN' && (pathname.startsWith('/dashboard') || pathname.startsWith('/dashboard-profesional'))) {
        return NextResponse.redirect(new URL('/admin', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/dashboard-profesional/:path*', 
    '/admin/:path*'
  ],
};
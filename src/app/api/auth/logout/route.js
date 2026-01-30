import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Forma nativa de Next.js para borrar cookies
  cookies().delete('sessionToken');

  return NextResponse.json({ 
    ok: true, 
    message: 'Sesión cerrada exitosamente' 
  });
}
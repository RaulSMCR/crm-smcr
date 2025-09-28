// src/app/api/auth/google/connect/route.js
import { NextResponse } from 'next/server';
import { oAuth2Client } from '@/lib/google'; // Importamos nuestro cliente configurado

// Los "scopes" son los permisos que solicitamos
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly', // Ver eventos del calendario
  'https://www.googleapis.com/auth/calendar.events',    // Crear y editar eventos
];

export async function GET() {
  // Generamos la URL a la que el usuario será redirigido
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // Necesario para obtener un refresh_token
    scope: SCOPES,
  });

  // Redirigimos al usuario a la página de consentimiento de Google
  return NextResponse.redirect(authUrl);
}
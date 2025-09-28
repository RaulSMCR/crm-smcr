// src/lib/google.js
import { google } from 'googleapis';

// Creamos un nuevo cliente OAuth2 con las credenciales de nuestro proyecto
export const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  // Esta es la "dirección de retorno" a la que Google enviará al usuario
  process.env.NODE_ENV === 'production'
    ? 'https://www.saludmentalcostarica.com/api/auth/google/callback'
    : 'http://localhost:3000/api/auth/google/callback'
);
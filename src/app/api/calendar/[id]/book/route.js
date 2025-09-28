// src/app/api/calendar/[id]/book/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { oAuth2Client } from '@/lib/google';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(request, { params }) {
  const professionalId = parseInt(params.id);

  try {
    // 1. Verificar la sesión del usuario que está agendando la cita
    const sessionToken = request.cookies.get('sessionToken')?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: 'Debes iniciar sesión para agendar.' }, { status: 401 });
    }
    const { payload: userPayload } = await jwtVerify(sessionToken, JWT_SECRET);

    // Obtener el email del usuario que ha iniciado sesión
    const user = await prisma.user.findUnique({ where: { id: userPayload.userId } });
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    // 2. Obtener los tokens del profesional y la hora de la cita del cuerpo de la solicitud
    const professional = await prisma.professional.findUnique({ where: { id: professionalId } });
    const { selectedTime } = await request.json();

    if (!professional || !professional.googleRefreshToken) {
      return NextResponse.json({ error: 'El profesional no ha conectado su calendario.' }, { status: 400 });
    }

    // 3. Configurar el cliente de Google con los tokens del profesional
    oAuth2Client.setCredentials({
      refresh_token: professional.googleRefreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // 4. Crear el evento en Google Calendar
    const startTime = new Date(selectedTime);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // La cita dura 1 hora

    const event = {
      summary: `Cita con ${user.name}`,
      description: `Cita agendada a través de la plataforma Salud Mental Costa Rica.`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Costa_Rica', // Asegúrate de que esta zona horaria sea correcta
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Costa_Rica',
      },
      // Añadir al usuario y al profesional como invitados al evento para que les llegue la notificación
      attendees: [
        { email: user.email },
        { email: professional.email },
      ],
    };

    await calendar.events.insert({
      calendarId: 'primary', // 'primary' se refiere al calendario principal del profesional
      requestBody: event,
      sendNotifications: true, // Envía invitaciones por correo a los asistentes
    });

    // 5. Devolver una respuesta de éxito
    return NextResponse.json({ message: '¡Cita agendada con éxito!' });

  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json({ error: 'No se pudo crear la cita en el calendario.' }, { status: 500 });
  }
}
// src/app/api/calendar/[id]/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';
import { oAuth2Client } from '@/lib/google';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
  const professionalId = parseInt(params.id);

  try {
    // 1. Obtener los tokens del profesional desde nuestra base de datos
    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
    });

    if (!professional || !professional.googleRefreshToken) {
      return NextResponse.json({ error: 'El profesional no ha conectado su calendario.' }, { status: 400 });
    }

    // 2. Configurar el cliente de Google con los tokens del profesional
    oAuth2Client.setCredentials({
      refresh_token: professional.googleRefreshToken,
    });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // 3. Consultar los eventos (horarios ocupados) del calendario del profesional
    //    para los próximos 30 días.
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: new Date().toISOString(),
        timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        items: [{ id: 'primary' }], // 'primary' se refiere al calendario principal
      },
    });

    const busySlots = response.data.calendars.primary.busy;

    // 4. Devolver la lista de horarios ocupados
    return NextResponse.json({ busy: busySlots });

  } catch (error) {
    console.error('Error fetching calendar availability:', error);
    return NextResponse.json({ error: 'No se pudo obtener la disponibilidad del calendario.' }, { status: 500 });
  }
}
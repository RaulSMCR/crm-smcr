// src/app/api/auth/register-professional/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      nombreCompleto, 
      profesion,
      email, 
      telefono,
      password, 
    } = body;
    // Note: We are ignoring the file uploads (CV, cover letter) for now.
    // Handling file uploads requires a more complex setup.

    const hashedPassword = await bcrypt.hash(password, 10);

    const newProfessional = await prisma.professional.create({
      data: {
        name: nombreCompleto,
        profession: profesion,
        email: email,
        phone: telefono,
        passwordHash: hashedPassword,
        // We leave isApproved as its default value (false)
      },
    });
    
    // Here, we would add code to send an email to the admin.
    // For now, we will simulate it with a console log.
    console.log(`New professional application from: ${email}. Please review.`);

    return NextResponse.json(newProfessional, { status: 201 });

  } catch (error) {
    console.error('Professional Registration Error:', error);
    return NextResponse.json({ message: 'Error creating professional. The email might already exist.' }, { status: 500 });
  }
}
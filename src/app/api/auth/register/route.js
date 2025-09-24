// src/app/api/auth/register/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      nombreCompleto, 
      email, 
      password, 
      identificacion, 
      fechaNacimiento, // This can be an empty string
      telefono, 
      intereses 
    } = body;

    // --- NEW VALIDATION STEP ---
    if (!fechaNacimiento) {
      return NextResponse.json({ message: 'La fecha de nacimiento es requerida.' }, { status: 400 });
    }
    const birthDateObj = new Date(fechaNacimiento);
    if (isNaN(birthDateObj.getTime())) {
      return NextResponse.json({ message: 'El formato de la fecha de nacimiento no es válido.' }, { status: 400 });
    }
    // -------------------------

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name: nombreCompleto,
        email: email,
        passwordHash: hashedPassword,
        identification: identificacion,
        birthDate: birthDateObj, // Use the validated date object
        phone: telefono,
        interests: intereses,
      },
    });

    return NextResponse.json(newUser, { status: 201 });

  } catch (error) {
    console.error('Registration Error:', error);
    // This will now catch other errors, like if the email is already in use
    return NextResponse.json({ message: 'Error al crear el usuario. El email o la identificación ya podrían existir.' }, { status: 500 });
  }
}
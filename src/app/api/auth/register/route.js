// src/app/api/auth/register/route.js
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose'; // Use the same modern library
import { serialize } from 'cookie';

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function POST(request) {
  try {
    // ... (code to get form data and create the user)

    const newUser = await prisma.user.create({
      // ... (data for the new user)
    });

    // --- NEW LOGIC: LOG THE USER IN AUTOMATICALLY ---
    const payload = { userId: newUser.id, name: newUser.name, role: 'USER' };
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JWT_SECRET);

    const cookie = serialize('sessionToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60,
      path: '/',
    });

    const response = NextResponse.json(newUser, { status: 201 });
    response.headers.set('Set-Cookie', cookie); // Attach the session cookie
    return response;

  } catch (error) {
    // ... (error handling)
  }
}
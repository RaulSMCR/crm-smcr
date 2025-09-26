import { NextResponse } from 'next/server';
import { serialize } from 'cookie';

export async function POST() {
  // Create a cookie that expires in the past to effectively delete it
  const cookie = serialize('sessionToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: -1, // Expire immediately
    path: '/',
  });

  const response = NextResponse.json({ message: 'Logged out successfully' });
  response.headers.set('Set-Cookie', cookie);
  return response;
}
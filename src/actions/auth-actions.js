'use server'

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
// import { verifyToken } from '@/lib/jwt'; // Asumo que tienes una utilidad para validar JWT

export async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get('auth_token'); // O como llames a tu cookie

  if (!token) return null;

  try {
    // Aquí iría tu lógica real de validación de token
    // const payload = verifyToken(token.value);
    
    // MOCK (Simulación para que funcione el ejemplo):
    return {
      ok: true,
      role: 'USER', // Cambia esto dinámicamente según tu token real
      profile: { name: 'Usuario Ejemplo', id: '123' }
    };
  } catch (error) {
    return null;
  }
}

export async function logout() {
  const cookieStore = cookies();
  cookieStore.delete('auth_token');
  redirect('/ingresar');
}
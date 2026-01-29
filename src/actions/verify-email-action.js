'use server'

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * Verifica el token de email y activa la cuenta.
 * Retorna: { success: boolean, message: string }
 */
export async function verifyEmailToken(token) {
  if (!token) return { error: 'Token no proporcionado.' };

  // 1. Recrear el hash del token para buscarlo en DB
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    // 2. Intentar buscar en Usuarios (Pacientes)
    const user = await prisma.user.findFirst({
      where: {
        verifyTokenHash: tokenHash,
        verifyTokenExp: { gt: new Date() } // Que no haya expirado
      }
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verifyTokenHash: null, // Limpieza
          verifyTokenExp: null,
          verifyEmailLastSentAt: null
        }
      });
      return { success: true, message: '¡Tu correo ha sido verificado exitosamente!' };
    }

    // 3. Intentar buscar en Profesionales
    const professional = await prisma.professional.findFirst({
      where: {
        verifyTokenHash: tokenHash,
        verifyTokenExp: { gt: new Date() }
      }
    });

    if (professional) {
      await prisma.professional.update({
        where: { id: professional.id },
        data: {
          emailVerified: true,
          verifyTokenHash: null,
          verifyTokenExp: null,
          verifyEmailLastSentAt: null
        }
      });
      return { success: true, message: '¡Correo profesional verificado correctamente!' };
    }

    // 4. Si llegamos aquí, el token no existe o expiró
    return { error: 'El enlace de verificación es inválido o ha expirado.' };

  } catch (error) {
    console.error('Error verificando email:', error);
    return { error: 'Ocurrió un error interno al verificar el correo.' };
  }
}
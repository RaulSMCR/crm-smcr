'use server'

import { prisma } from '@/lib/prisma';
import { generateSecurityToken, validateTokenHash } from '@/lib/tokens';
import { sendPasswordResetEmail } from '@/lib/mail';
import bcrypt from 'bcryptjs';

/**
 * 1. SOLICITAR RESET
 * Recibe el email, genera el token y lo envía.
 */
export async function requestPasswordReset(email) {
  try {
    // A. Buscar usuario (Paciente)
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await generateAndSendToken(user.id, user.email, 'USER');
      // Retornamos éxito genérico por seguridad (evitar enumeración de usuarios)
      return { success: true, message: 'Si el correo existe, recibirás instrucciones.' };
    }

    // B. Buscar Profesional
    const professional = await prisma.professional.findUnique({ where: { email } });
    if (professional) {
      await generateAndSendToken(professional.id, professional.email, 'PROFESSIONAL');
      return { success: true, message: 'Si el correo existe, recibirás instrucciones.' };
    }

    // C. No encontrado (Simulamos éxito por seguridad)
    return { success: true, message: 'Si el correo existe, recibirás instrucciones.' };

  } catch (error) {
    console.error('Error requestPasswordReset:', error);
    return { error: 'Error interno del servidor.' };
  }
}

/**
 * Función auxiliar interna para guardar token y enviar mail
 */
async function generateAndSendToken(id, email, modelType) {
  const { token, tokenHash, expiresAt } = generateSecurityToken();

  // Guardar hash en la tabla correcta
  if (modelType === 'USER') {
    await prisma.user.update({
      where: { id },
      data: { resetTokenHash: tokenHash, resetTokenExp: expiresAt }
    });
  } else {
    await prisma.professional.update({
      where: { id },
      data: { resetTokenHash: tokenHash, resetTokenExp: expiresAt }
    });
  }

  // Enviar el email con el token CRUDO (sin hashear)
  await sendPasswordResetEmail(email, token);
}

/**
 * 2. COMPLETAR RESET
 * Recibe el token y la nueva contraseña.
 */
export async function resetPassword(token, newPassword) {
  if (!token || !newPassword) {
    return { error: 'Datos incompletos.' };
  }

  try {
    // Generar hash del token recibido para buscar en DB
    // Nota: Como no sabemos de quién es el token, tenemos que buscar en ambas tablas
    // OJO: Prisma no permite buscar por campos que no sean @unique fácilmente sin where
    // Estrategia: Hasheamos el token recibido y buscamos el usuario que tenga ese hash
    
    // Necesitamos el hash SHA256 del token que viene de la URL
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // 1. Buscar en Users
    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExp: { gt: new Date() } // Que no haya expirado
      }
    });

    if (user) {
      return await updateUserPassword(user.id, 'USER', newPassword);
    }

    // 2. Buscar en Professionals
    const professional = await prisma.professional.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExp: { gt: new Date() }
      }
    });

    if (professional) {
      return await updateUserPassword(professional.id, 'PROFESSIONAL', newPassword);
    }

    return { error: 'Token inválido o expirado.' };

  } catch (error) {
    console.error('Error resetPassword:', error);
    return { error: 'Error al restablecer la contraseña.' };
  }
}

/**
 * Función auxiliar para actualizar la password y limpiar el token
 */
async function updateUserPassword(id, modelType, newPassword) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  if (modelType === 'USER') {
    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
        resetTokenHash: null, // Quemamos el token
        resetTokenExp: null
      }
    });
  } else {
    await prisma.professional.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
        resetTokenHash: null,
        resetTokenExp: null
      }
    });
  }

  return { success: true, message: 'Contraseña actualizada correctamente.' };
}
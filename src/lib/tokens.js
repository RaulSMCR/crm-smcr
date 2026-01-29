import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Genera un token aleatorio y su hash para guardar en DB.
 * Retorna: { token, tokenHash, expiresAt }
 * @param {number} expiresInMinutes - Tiempo de expiración (default 60 mins)
 */
export const generateSecurityToken = (expiresInMinutes = 60) => {
  // 1. Generar el token crudo (el que se envía por email)
  // Usamos uuid para unicidad + randomBytes para entropía extra
  const token = `${uuidv4()}-${crypto.randomBytes(16).toString('hex')}`;

  // 2. Crear hash para la DB (SHA-256 es suficiente y rápido para tokens temporales)
  // Nota: Podríamos usar bcrypt, pero SHA256 es estándar para tokens de un solo uso
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  // 3. Calcular fecha de expiración
  const expiresAt = new Date(new Date().getTime() + expiresInMinutes * 60 * 1000);

  return { token, tokenHash, expiresAt };
};

/**
 * Verifica si un token crudo coincide con el hash guardado
 */
export const validateTokenHash = (rawToken, storedHash) => {
  const hash = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');
  return hash === storedHash;
};
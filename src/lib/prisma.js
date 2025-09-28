// src/lib/prisma.js
import { PrismaClient } from '@prisma/client';

/**
 * Singleton de Prisma para evitar múltiples conexiones en desarrollo.
 * - Usa una referencia en globalThis para reutilizar la instancia entre recargas.
 * - Exporta SIEMPRE un named export: { prisma }
 * - En tus handlers: import { prisma } from '@/lib/prisma';
 */

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma__ ??
  new PrismaClient({
    log: ['warn', 'error'], // puedes agregar 'query' si necesitas depurar
  });

// Guarda la instancia en globalThis en dev/hot-reload.
if (!globalForPrisma.__prisma__) {
  globalForPrisma.__prisma__ = prisma;
}

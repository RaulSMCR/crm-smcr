// src/lib/prisma.js
import { PrismaClient } from "@prisma/client";

/**
 * Singleton de Prisma:
 * - En dev: cachea en globalThis para evitar múltiples conexiones por hot-reload.
 * - En prod: no cachea en globalThis.
 *
 * Uso: import { prisma } from "@/lib/prisma";
 */

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma__ = prisma;
}

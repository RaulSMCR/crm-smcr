import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  // Forma Universal (funciona en v5, v6 y v7)
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Opcional: Logs para depurar si algo falla en producción
    // log: ['error'], 
  });
};

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export { prisma };

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
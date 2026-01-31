import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  // DEJAMOS EL CONSTRUCTOR VACÍO.
  // Prisma 7 leerá automáticamente la variable DATABASE_URL del entorno de Vercel.
  // No hace falta inyectarla manualmente.
  return new PrismaClient();
};

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export { prisma };

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  // 👈 AQUÍ está el cambio clave: pasamos la URL explícitamente
  return new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });
};

const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

export { prisma }; // O export default prisma, según como lo tengas

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
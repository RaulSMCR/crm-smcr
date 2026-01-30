// lib/data.js
import { prisma } from '@/lib/prisma';

export async function getCategoryTree() {
  // Obtenemos solo los PADRES (parentId: null) e incluimos sus HIJOS
  const categories = await prisma.category.findMany({
    where: {
      parentId: null, 
    },
    include: {
      children: {
        orderBy: { name: 'asc' }
      }
    },
    orderBy: {
      name: 'asc',
    },
  });
  
  return categories;
}
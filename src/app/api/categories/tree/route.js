import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'; // Asegura que no se cachee estáticamente

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { parentId: null }, // Solo los padres
      include: {
        children: {
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: "Error cargando categorías" }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const pendingPosts = await prisma.post.findMany({
      where: { status: 'PENDING' },
      include: { author: true }, // Include author info
    });
    return NextResponse.json(pendingPosts);
  } catch (error) {
    return NextResponse.json({ message: 'Error fetching posts' }, { status: 500 });
  }
}
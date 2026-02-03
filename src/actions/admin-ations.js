//(src/actions/admin-actions.js)
'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// --- SERVICIOS ---
export async function createService(formData) {
  const title = formData.get('title');
  const price = parseFloat(formData.get('price'));
  const duration = parseInt(formData.get('duration'));
  const description = formData.get('description');

  await prisma.service.create({
    data: { title, price, durationMin: duration, description }
  });
  revalidatePath('/panel/admin');
}

export async function deleteService(id) {
  await prisma.service.delete({ where: { id } });
  revalidatePath('/panel/admin');
}

// --- USUARIOS ---
export async function approveUser(id) {
  await prisma.user.update({
    where: { id },
    data: { isApproved: true }
  });
  revalidatePath('/panel/admin');
}

export async function toggleUserStatus(id, currentStatus) {
  await prisma.user.update({
    where: { id },
    data: { isActive: !currentStatus }
  });
  revalidatePath('/panel/admin');
}

export async function deleteUser(id) {
    // Ojo: Borrar usuario borra sus citas y perfil por la cascada
    await prisma.user.delete({ where: { id } });
    revalidatePath('/panel/admin');
}
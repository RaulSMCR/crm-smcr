//src/app/panel/admin/page.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminView from "./AdminView"; // <--- Importamos la vista

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getSession();

  if (!session || session.role !== 'ADMIN') {
    redirect('/ingresar');
  }

  // 1. OBTENER DATOS (Queries Paralelas para velocidad)
  const [
    pendingPros, 
    allUsers, 
    services, 
    appointments,
    metrics
  ] = await Promise.all([
    // A. Pendientes
    prisma.user.findMany({
      where: { role: 'PROFESSIONAL', isApproved: false },
      include: { professionalProfile: true }
    }),
    
    // B. Todos los usuarios (para gestión)
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50 // Límite por rendimiento
    }),

    // C. Servicios disponibles
    prisma.service.findMany(),

    // D. Últimas citas
    prisma.appointment.findMany({
      take: 20,
      orderBy: { date: 'desc' },
      include: { 
        patient: { select: { name: true } },
        professional: { include: { user: { select: { name: true } } } }
      }
    }),

    // E. Métricas (Counts)
    prisma.$transaction([
        prisma.user.count({ where: { role: 'USER' } }),
        prisma.user.count({ where: { role: 'PROFESSIONAL' } }),
        prisma.appointment.count(),
    ])
  ]);

  // Cálculo simple de ingresos estimados (si tuvieras precios reales en citas)
  const stats = {
    totalUsers: metrics[0],
    totalPros: metrics[1],
    totalAppts: metrics[2],
    revenue: metrics[2] * 50 // Ejemplo: $50 por cita promedio
  };

  // Renderizamos la vista Cliente pasándole los datos Servidor
  return (
    <AdminView 
        stats={stats}
        pendingPros={pendingPros}
        allUsers={allUsers}
        services={services}
        appointments={appointments}
    />
  );
}
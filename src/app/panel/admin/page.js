//src/app/panel/admin/page.js
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth"; // Usa la librería corregida
import { redirect } from "next/navigation";
import Link from "next/link"; // Importar Link para navegación

export default async function AdminDashboard() {
  const session = await getSession();

  // 1. Protección de Ruta (Doble seguridad)
  if (!session || session.role !== 'ADMIN') {
    redirect('/ingresar');
  }

  // 2. Obtener profesionales pendientes
  const pendingPros = await prisma.user.findMany({
    where: {
      role: 'PROFESSIONAL',
      isApproved: false
    },
    include: {
      professionalProfile: true
    }
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Panel de Administración</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Profesionales Pendientes de Aprobación ({pendingPros.length})
        </h2>

        {pendingPros.length === 0 ? (
          <p className="text-gray-500 italic">No hay solicitudes pendientes.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-sm text-gray-500">
                  <th className="py-3">Nombre</th>
                  <th className="py-3">Email</th>
                  <th className="py-3">Especialidad</th>
                  <th className="py-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {pendingPros.map((user) => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 font-medium">{user.name}</td>
                    <td className="py-3 text-gray-600">{user.email}</td>
                    <td className="py-3 text-blue-600">
                      {user.professionalProfile?.specialty || 'N/A'}
                    </td>
                    <td className="py-3">
                       {/* Aquí usaremos un Server Action para aprobar */}
                       <form action={async () => {
                          'use server'
                          await prisma.user.update({
                            where: { id: user.id },
                            data: { isApproved: true }
                          });
                          // Revalidar la página actual
                          redirect('/panel/admin'); 
                       }}>
                          <button 
                            type="submit"
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition"
                          >
                            Aprobar
                          </button>
                       </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

       {/* Botón temporal para volver al inicio */}
       <div className="mt-8">
        <Link href="/" className="text-blue-600 hover:underline">
          ← Volver al Inicio
        </Link>
      </div>
    </div>
  );
}
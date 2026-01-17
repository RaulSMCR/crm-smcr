export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Usuarios</h1>

      <p className="text-neutral-600">
        Panel de administración de usuarios.
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">
          Próximamente: listado, filtros, roles, actividad y estadísticas.
        </p>
      </div>
    </main>
  );
}

export const dynamic = "force-dynamic";

export default function AdminPostsPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Contenido</h1>

      <p className="text-neutral-600">
        Gestión de artículos, podcasts y videos.
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">
          Próximamente: borradores, aprobaciones, estados y autores.
        </p>
      </div>
    </main>
  );
}

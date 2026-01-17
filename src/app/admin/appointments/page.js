export const dynamic = "force-dynamic";

export default function AdminAppointmentsPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Turnos</h1>

      <p className="text-neutral-600">
        Vista administrativa de citas entre usuarios y profesionales.
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 p-4">
        <p className="text-sm text-neutral-500">
          Próximamente: calendario global, estados y pagos asociados.
        </p>
      </div>
    </main>
  );
}

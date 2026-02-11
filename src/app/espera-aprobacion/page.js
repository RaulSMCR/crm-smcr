// src/app/espera-aprobacion/page.js
import Link from "next/link";

export const metadata = {
  title: "Esperando aprobación | Salud Mental Costa Rica",
};

export default function EsperaAprobacionPage() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white border rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-2 text-center">Tu cuenta está en revisión</h1>
        <p className="text-gray-700 text-sm mb-4 text-center">
          Gracias por registrarte como profesional. Un administrador debe aprobar tu perfil antes de que
          puedas acceder al panel profesional.
        </p>

        <div className="space-y-3">
          <div className="rounded-lg border bg-neutral-50 p-3 text-sm text-gray-700">
            <p className="font-medium mb-1">¿Qué sigue?</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Revisaremos tus datos y documentos.</li>
              <li>Cuando tu cuenta sea aprobada, podrás ingresar normalmente.</li>
              <li>Si necesitás corregir algo, te contactaremos por correo.</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Link
              href="/"
              className="flex-1 text-center px-4 py-2 rounded bg-neutral-900 text-white hover:bg-neutral-950"
            >
              Volver al inicio
            </Link>
            <Link
              href="/ingresar"
              className="flex-1 text-center px-4 py-2 rounded border hover:bg-neutral-50"
            >
              Ir a ingresar
            </Link>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Si creés que esto es un error, escribinos desde{" "}
            <Link className="underline" href="/contacto">
              contacto
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

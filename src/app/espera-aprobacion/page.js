// src/app/espera-aprobacion/page.js
import Link from "next/link";

export const metadata = {
  title: "Esperando aprobacion | Salud Mental Costa Rica",
};

export default function EsperaAprobacionPage() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white border rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-2 text-center">Su cuenta se encuentra en revision</h1>
        <p className="text-gray-700 text-sm mb-4 text-center">
          Gracias por completar el registro profesional. El proceso de revision avanza antes de habilitar el acceso al panel profesional, para proteger la calidad de atencion.
        </p>

        <div className="space-y-3">
          <div className="rounded-lg border bg-neutral-50 p-3 text-sm text-gray-700">
            <p className="font-medium mb-1">Proximo paso</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Se revisaran los datos y documentos enviados.</li>
              <li>Cuando la cuenta sea aprobada, podra ingresar con normalidad.</li>
              <li>Si se requiere algun ajuste, se enviara una notificacion por correo.</li>
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
              Ir al ingreso
            </Link>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Si considera que se trata de un error, puede escribir desde{" "}
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

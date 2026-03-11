import Link from "next/link";

export const metadata = {
  title: "Espera de aprobación | Salud Mental Costa Rica",
};

export default function EsperaAprobacionPage() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-300 bg-neutral-50 p-6 shadow-card">
        <h1 className="mb-2 text-center text-2xl font-bold text-brand-900">
          Su cuenta se encuentra en revisión
        </h1>
        <p className="mb-4 text-center text-sm text-neutral-800">
          Gracias por completar el registro profesional. El proceso de revisión avanza
          antes de habilitar el acceso al panel profesional, para proteger la calidad de
          atención.
        </p>

        <div className="space-y-3">
          <div className="rounded-xl border border-accent-300 bg-accent-50 p-4 text-sm text-accent-950">
            <p className="mb-1 font-semibold">Próximo paso</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Se revisarán los datos y documentos enviados.</li>
              <li>Cuando la cuenta sea aprobada, podrá ingresar con normalidad.</li>
              <li>Si se requiere algún ajuste, se enviará una notificación por correo.</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Link
              href="/"
              className="flex-1 rounded-xl bg-brand-800 px-4 py-2 text-center font-semibold text-white hover:bg-brand-900"
            >
              Volver al inicio
            </Link>
            <Link
              href="/ingresar"
              className="flex-1 rounded-xl border border-neutral-400 bg-neutral-100 px-4 py-2 text-center font-semibold text-neutral-950 hover:bg-neutral-200"
            >
              Ir al ingreso
            </Link>
          </div>

          <p className="text-center text-xs text-neutral-700">
            Si considera que se trata de un error, puede escribir desde{" "}
            <Link className="font-semibold text-brand-800 hover:text-brand-900" href="/contacto">
              contacto
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

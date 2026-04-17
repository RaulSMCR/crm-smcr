import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function ExternalLinkCard({ href, label, description, icon }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-4 rounded-2xl border border-neutral-300 bg-neutral-50 p-6 shadow-card transition-all hover:border-brand-400 hover:bg-brand-50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-appbg text-brand-700 group-hover:text-brand-900">
        {icon}
      </div>
      <div>
        <p className="font-bold text-neutral-950 group-hover:text-brand-900">{label}</p>
        <p className="mt-0.5 text-xs text-neutral-600">{description}</p>
      </div>
    </a>
  );
}

export default async function AdminComunicacionesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link href="/panel/admin" className="text-sm text-neutral-500 hover:text-neutral-700">
            Panel
          </Link>
          <h1 className="text-3xl font-bold text-brand-900">Comunicaciones</h1>
          <p className="text-sm text-neutral-700">Accesos directos a los canales de comunicación de SMCR.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ExternalLinkCard
            href="https://am1.myprofessionalmail.com/appsuite/#!!&app=io.ox/mail&folder=default0/INBOX"
            label="contacto@saludmentalcostarica.com"
            description="Bandeja de entrada del correo de contacto principal."
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
                <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
              </svg>
            }
          />
        </div>
      </div>
    </div>
  );
}

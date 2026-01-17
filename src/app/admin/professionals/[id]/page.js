import Link from "next/link";
import { prisma } from "@/lib/prisma";
import AdminApproveButton from "@/components/AdminApproveButton";

export const revalidate = 0;

function formatDateTime(date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminProfessionalDetailPage({ params }) {
  const id = Number(params?.id);

  if (!Number.isInteger(id)) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-red-700">ID inválido.</p>
        <Link className="underline" href="/admin/professionals">
          Volver
        </Link>
      </main>
    );
  }

  const p = await prisma.professional.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      profession: true,
      phone: true,
      bio: true,
      avatarUrl: true,
      introVideoUrl: true,
      calendarUrl: true,
      paymentLinkBase: true,
      emailVerified: true,
      isApproved: true,
      createdAt: true,
      approvedAt: true,
      approvedByUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!p) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-red-700">Profesional no encontrado.</p>
        <Link className="underline" href="/admin/professionals">
          Volver
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold truncate">{p.name}</h1>
          <p className="text-sm text-neutral-700">{p.email}</p>
          <p className="text-sm text-neutral-600">{p.profession}</p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span
              className={
                "rounded-full px-2 py-1 border " +
                (p.emailVerified
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-amber-200 bg-amber-50 text-amber-800")
              }
            >
              Email: {p.emailVerified ? "verificado" : "pendiente"}
            </span>

            <span
              className={
                "rounded-full px-2 py-1 border " +
                (p.isApproved
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800")
              }
            >
              {p.isApproved ? "Aprobado" : "Sin aprobar"}
            </span>

            <span className="rounded-full px-2 py-1 border border-neutral-200 bg-neutral-50 text-neutral-700">
              Alta: {formatDateTime(new Date(p.createdAt))}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href="/admin/professionals"
            className="rounded-md border px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Volver
          </Link>

          {!p.isApproved ? (
            <AdminApproveButton
              label="Aprobar profesional"
              endpoint={`/api/admin/professionals/${p.id}/approve`}
            />
          ) : null}
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono" value={p.phone ?? "—"} />
          <Field label="Bio" value={p.bio ?? "—"} className="sm:col-span-2" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <LinkField label="Avatar URL" href={p.avatarUrl} />
          <LinkField label="Intro video URL" href={p.introVideoUrl} />
          <LinkField label="Calendario URL" href={p.calendarUrl} />
          <LinkField label="Payment link base" href={p.paymentLinkBase} />
        </div>

        {p.isApproved ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
            Aprobado el{" "}
            <b>{p.approvedAt ? formatDateTime(new Date(p.approvedAt)) : "—"}</b>
            {p.approvedByUser ? (
              <>
                {" "}
                por <b>{p.approvedByUser.name}</b> ({p.approvedByUser.email})
              </>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Pendiente de aprobación.
          </div>
        )}
      </section>
    </main>
  );
}

function Field({ label, value, className = "" }) {
  return (
    <div className={className}>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-sm text-neutral-800 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function LinkField({ label, href }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      {href ? (
        <a
          className="text-sm text-brand-700 underline break-all"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          {href}
        </a>
      ) : (
        <div className="text-sm text-neutral-800">—</div>
      )}
    </div>
  );
}

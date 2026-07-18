// src/app/mi/page.js — Inicio de la PWA de pacientes (server component).
// Renderiza server-side: próximo turno, aviso de pago pendiente y frase del día.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatDateTimeInTZ } from "@/lib/timezone";
import { getFraseDelDia } from "@/lib/mi/frases";
import { Card, Pill } from "@/components/mi/ui";
import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

const UPCOMING_STATUSES = ["PENDING", "CONFIRMED"];
const UNPAID_STATUSES = ["UNPAID", "PARTIALLY_PAID"];

// Tiempo restante natural ("mañana", "en 3 días", "en 2 horas"). No es lógica de
// timezone (es una duración absoluta), así que usamos Intl.RelativeTimeFormat.
function tiempoRestante(date) {
  const diffMs = new Date(date).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const minutes = Math.round(diffMs / 60000);

  let phrase;
  if (minutes < 60) phrase = rtf.format(Math.max(1, minutes), "minute");
  else if (minutes < 60 * 24) phrase = rtf.format(Math.round(minutes / 60), "hour");
  else phrase = rtf.format(Math.round(minutes / (60 * 24)), "day");

  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

function StatusBadge({ status }) {
  if (status === "CONFIRMED") return <Pill tone="teal">Confirmada</Pill>;
  return <Pill tone="coral">Por confirmar</Pill>;
}

function ProximoTurno({ cita }) {
  if (!cita) {
    return (
      <Card className="text-center">
        <p className="font-semibold text-neutral-800">No hay encuentros a la vista</p>
        <p className="mt-1 text-sm text-neutral-500">
          ¿Cuál será tu próximo paso?
        </p>
        <Link
          href="/servicios"
          className="mt-4 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
        >
          Agendar
        </Link>
      </Card>
    );
  }

  const proName = cita.professional?.user?.name || "Profesional";
  const specialty = cita.professional?.specialty;

  return (
    <Card className="border-brand-200 ring-1 ring-brand-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-neutral-900">{formatDateTimeInTZ(cita.date)}</p>
          <p className="mt-0.5 text-sm font-semibold text-brand-700">{tiempoRestante(cita.date)}</p>
        </div>
        <StatusBadge status={cita.status} />
      </div>

      <div className="mt-3 border-t border-neutral-100 pt-3">
        <p className="text-sm font-medium text-neutral-800">{proName}</p>
        {specialty ? <p className="text-xs text-neutral-500">{specialty}</p> : null}
        {cita.service?.title ? (
          <p className="mt-1 text-sm text-neutral-600">{cita.service.title}</p>
        ) : null}
      </div>

      <Link
        href="/mi/agenda"
        className="mt-4 inline-flex rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
      >
        Ver mi agenda
      </Link>
    </Card>
  );
}

function PagoPendienteBanner() {
  return (
    <Link
      href="/mi/pagos"
      className="flex items-center justify-between gap-3 rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 transition-colors hover:bg-accent-100"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-accent-900">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-accent-600"
          aria-hidden="true"
        >
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
        Tenés un pago pendiente
      </span>
      <span aria-hidden="true" className="text-accent-700">→</span>
    </Link>
  );
}

function FraseDelDia({ frase }) {
  return (
    <section>
      <div className="rounded-2xl border border-neutral-200 bg-appbg p-5 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Frase del día</p>
        <blockquote className="mt-2">
          <p className="text-lg font-medium italic leading-relaxed text-neutral-800">
            «{frase.texto}»
          </p>
          {frase.autor ? (
            <footer className="mt-2 text-sm font-semibold text-brand-700">— {frase.autor}</footer>
          ) : null}
        </blockquote>
      </div>
    </section>
  );
}

export default async function MiInicioPage() {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/mi");

  const patientId = String(session.userId || session.sub);
  const now = new Date();

  const [proximaCita, pagoPendiente] = await Promise.all([
    prisma.appointment.findFirst({
      where: { patientId, date: { gt: now }, status: { in: UPCOMING_STATUSES } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        status: true,
        service: { select: { title: true } },
        professional: {
          select: { specialty: true, user: { select: { name: true } } },
        },
      },
    }),
    prisma.appointment.findFirst({
      where: {
        patientId,
        paymentStatus: { in: UNPAID_STATUSES },
        status: { in: UPCOMING_STATUSES },
      },
      select: { id: true },
    }),
  ]);

  const frase = getFraseDelDia();
  const primerNombre = session.name ? String(session.name).split(/\s+/)[0] : null;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand-800">
            Te esperábamos{primerNombre ? `, ${primerNombre}` : ""}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">Esta es la puerta a tu espacio de bienestar.</p>
        </div>
        {/* Acciones de cuenta dentro de /mi: el header/footer del sitio está
            oculto acá (ver layout de /mi). "Editar perfil" lleva al panel clásico
            (perfil, seguro); LogoutButton es el único punto de logout de la PWA. */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Link
            href="/panel/paciente"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-100"
          >
            Mi bitácora
          </Link>
          <LogoutButton />
        </div>
      </header>

      {pagoPendiente ? <PagoPendienteBanner /> : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Tu próximo encuentro
        </h2>
        <ProximoTurno cita={proximaCita} />
      </section>

      <FraseDelDia frase={frase} />
    </div>
  );
}

// src/app/pro/semana/page.js — «Semana» en la app de profesionales.
// Siete días con todas las citas activas, los días libres incluidos, y
// navegación de a una semana (?desde=YYYY-MM-DD) hasta donde llega la ventana
// en que se conocen bloqueos y Google.
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { formatDayTab, instanteDeHoraCR } from "@/lib/appointment-slots";
import { agruparPorDia, semanaDesde } from "@/lib/pro/agenda-semana";
import CitaDelDia from "@/components/pro/CitaDelDia";
import { SectionHeader } from "@/components/mi/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Semana" };

const NAV =
  "rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-100";
const NAV_APAGADO = "rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-300";

export default async function ProSemanaPage({ searchParams }) {
  const session = await getSession();
  if (!session) redirect("/ingresar?next=/pro/semana");
  const professionalId = String(session.professionalProfileId || "");

  const ahora = new Date();
  // Next 16: searchParams es una promesa.
  const { desde: desdeParam } = (await searchParams) || {};
  const semana = semanaDesde(desdeParam, ahora);

  // Aislamiento por profesional: todas las citas son de su perfil.
  const citas = await prisma.appointment.findMany({
    where: {
      professionalId,
      status: { in: ["PENDING", "CONFIRMED"] },
      date: { gte: semana.inicio, lt: semana.fin },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      status: true,
      paymentStatus: true,
      modality: true,
      locationName: true,
      locationAddress: true,
      locationNotes: true,
      meetLink: true,
      acuerdoId: true,
      patient: { select: { name: true, phone: true } },
      service: { select: { title: true } },
    },
  });

  const dias = agruparPorDia(citas, semana.dias);
  const titulo = (ymd) => formatDayTab(instanteDeHoraCR(ymd));

  return (
    <>
      <SectionHeader title="Semana" subtitle={`${titulo(semana.dias[0])} – ${titulo(semana.dias.at(-1))}`} />

      <div className="mb-5 flex items-center justify-between">
        {semana.anterior ? (
          <Link href={`/pro/semana?desde=${semana.anterior}`} className={NAV}>
            ← Anterior
          </Link>
        ) : (
          <span className={NAV_APAGADO}>← Anterior</span>
        )}
        <span className="text-xs text-neutral-500">
          {citas.length === 1 ? "1 cita" : `${citas.length} citas`}
        </span>
        {semana.siguiente ? (
          <Link href={`/pro/semana?desde=${semana.siguiente}`} className={NAV}>
            Siguiente →
          </Link>
        ) : (
          <span className={NAV_APAGADO}>Siguiente →</span>
        )}
      </div>

      {dias.map(({ dia, citas: delDia }) => (
        <section key={dia} className="mb-5">
          <h2 className="mb-2 text-sm font-semibold capitalize text-brand-800">{titulo(dia)}</h2>
          {delDia.length > 0 ? (
            <div className="space-y-3">
              {delDia.map((cita) => (
                <CitaDelDia
                  key={cita.id}
                  cita={cita}
                  // Una confirmada de hoy que ya empezó se cierra, no se mueve.
                  porCerrar={cita.status === "CONFIRMED" && new Date(cita.date) <= ahora}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-neutral-300 px-3 py-2 text-xs text-neutral-500">Libre</p>
          )}
        </section>
      ))}
    </>
  );
}

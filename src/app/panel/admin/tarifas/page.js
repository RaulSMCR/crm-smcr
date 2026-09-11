// src/app/panel/admin/tarifas/page.js
// Cola de revisión de las tarifas, de las solicitudes de consulta y de las
// escaleras de precio propuestas por los profesionales.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listPendingServiceRequests, listRatesForReview } from "@/actions/rate-review-actions";
import { listPriceLaddersForReview } from "@/actions/price-ladder-actions";
import { formatCRC } from "@/lib/service-pricing";
import RateReviewPanel from "@/components/admin/RateReviewPanel";
import PriceLadderReviewPanel from "@/components/admin/PriceLadderReviewPanel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TABS = [
  { key: "PENDING", label: "Pendientes" },
  { key: "APPROVED", label: "Vigentes" },
  { key: "REJECTED", label: "Rechazadas" },
];

export default async function AdminTarifasPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  // Next 16: searchParams es una Promise; leerlo sin await devuelve undefined.
  const params = await searchParams;
  const status = TABS.some((tab) => tab.key === params?.status) ? params.status : "PENDING";

  const [{ data }, solicitudesRes, escalerasRes] = await Promise.all([
    listRatesForReview(status),
    listPendingServiceRequests(),
    listPriceLaddersForReview(),
  ]);

  const rates = (data || []).map((rate) => ({
    ...rate,
    approvedPrice: rate.approvedPrice === null ? null : Number(rate.approvedPrice),
    proposedPrice: rate.proposedPrice === null ? null : Number(rate.proposedPrice),
  }));
  const solicitudes = solicitudesRes?.data || [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <Link href="/panel/admin" className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
          ← Volver al panel
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-slate-800">Tarifas</h1>
        <p className="mt-2 text-slate-500">
          Un precio solo entra en vigencia cuando se aprueba acá. Mientras tanto sigue rigiendo el
          anterior, así que revisar sin prisa no interrumpe la agenda de nadie.
        </p>
      </div>

      {solicitudes.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Solicitudes de consulta pendientes</h2>
          <p className="mt-1 text-sm text-slate-600">
            Profesionales que pidieron brindar una consulta, o que cambiaron su precio desde el perfil. Mientras
            estén pendientes esa consulta no se publica ni se puede agendar. Se aprueban en la ficha del
            servicio, donde también se completa su clasificación fiscal (CABYS e IVA).
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {solicitudes.map((solicitud) => (
              <li
                key={`${solicitud.professionalId}-${solicitud.serviceId}`}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0 text-sm">
                  <div className="font-semibold text-slate-900">
                    {solicitud.professionalName} · {solicitud.serviceTitle}
                  </div>
                  <div className="text-slate-600">
                    Propone {formatCRC(solicitud.proposedPrice, { vacio: "sin precio" })}
                    {solicitud.fiscalCompleto ? "" : " · falta clasificar CABYS e IVA del servicio"}
                  </div>
                </div>
                <Link
                  href={`/panel/admin/servicios/${solicitud.serviceId}`}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Revisar solicitud
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/panel/admin/tarifas?status=${tab.key}`}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
              status === tab.key
                ? "border-blue-600 bg-blue-50 text-blue-900"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <RateReviewPanel rates={rates} status={status} />

      <section className="space-y-3 border-t border-slate-200 pt-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Escaleras de precio</h2>
          <p className="mt-1 text-sm text-slate-500">
            Precios de entrada para pacientes nuevos que suben por escalones a medida que se pagan los
            adelantos. Solo actúan sobre el precio general de la consulta.
          </p>
        </div>
        <PriceLadderReviewPanel escaleras={escalerasRes?.data || []} />
      </section>
    </div>
  );
}

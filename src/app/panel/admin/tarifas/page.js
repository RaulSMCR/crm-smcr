// src/app/panel/admin/tarifas/page.js
// Cola de revisión de las tarifas y de las escaleras de precio propuestas por los
// profesionales.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listRatesForReview } from "@/actions/rate-review-actions";
import { listPriceLaddersForReview } from "@/actions/price-ladder-actions";
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

  const [{ data }, escalerasRes] = await Promise.all([listRatesForReview(status), listPriceLaddersForReview()]);

  const rates = (data || []).map((rate) => ({
    ...rate,
    approvedPrice: rate.approvedPrice === null ? null : Number(rate.approvedPrice),
    proposedPrice: rate.proposedPrice === null ? null : Number(rate.proposedPrice),
  }));

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

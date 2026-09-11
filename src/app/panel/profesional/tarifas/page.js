// src/app/panel/profesional/tarifas/page.js
// Lugares de atención, franjas horarias y precios: todo lo que determina cuánto
// se le cobra a un paciente cuando agenda.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listMyRates, listPracticeLocations, listTimeBands } from "@/actions/practice-actions";
import { listMyPriceLadders } from "@/actions/price-ladder-actions";
import PracticeLocationsManager from "@/components/professional/PracticeLocationsManager";
import TimeBandsManager from "@/components/professional/TimeBandsManager";
import RatesManager from "@/components/professional/RatesManager";
import PriceLadderManager from "@/components/professional/PriceLadderManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TarifasPage() {
  const session = await getSession();
  if (!session || session.role !== "PROFESSIONAL") redirect("/ingresar");

  const [locationsRes, bandsRes, ratesRes, laddersRes] = await Promise.all([
    listPracticeLocations(),
    listTimeBands(),
    listMyRates(),
    listMyPriceLadders(),
  ]);

  const locations = locationsRes?.data || [];
  const timeBands = bandsRes?.data || [];
  const rates = ratesRes?.data?.rates || [];
  const assignments = ratesRes?.data?.assignments || [];

  // Serialización para el cliente: Decimal de Prisma no cruza el límite servidor/cliente.
  const plainRates = rates.map((rate) => ({
    ...rate,
    approvedPrice: rate.approvedPrice === null ? null : Number(rate.approvedPrice),
    proposedPrice: rate.proposedPrice === null ? null : Number(rate.proposedPrice),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <Link href="/panel/profesional" className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
          ← Volver al panel
        </Link>
        <h1 className="mt-1 text-3xl font-bold text-slate-800">Lugares y tarifas</h1>
        <p className="mt-2 text-slate-500">
          El precio que ve el paciente sale de acá. Al agendar se congela en la cita: si después cambia
          su tarifa, las citas ya reservadas mantienen el precio que el paciente aceptó.
        </p>
      </div>

      <PracticeLocationsManager initialLocations={locations} />
      <TimeBandsManager initialBands={timeBands} />
      <RatesManager
        rates={plainRates}
        assignments={assignments}
        locations={locations}
        timeBands={timeBands}
      />
      <PriceLadderManager
        escaleras={laddersRes?.data?.escaleras || []}
        consultas={laddersRes?.data?.consultas || []}
      />
    </div>
  );
}

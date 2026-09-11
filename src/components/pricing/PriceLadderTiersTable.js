// Escalones de una escalera de precios, en el panel del profesional y en el del admin.
import { formatCRC as formatCRCBase } from "@/lib/service-pricing";

// Formato compartido; esta tabla muestra "—" cuando no hay monto.
const formatCRC = (value) => formatCRCBase(value, { vacio: "—" });

export default function PriceLadderTiersTable({ escalera }) {
  const rige = escalera.status === "APPROVED";
  // En una propuesta todavía no se ocupó ningún cupo: solo se muestra la meta.
  const conOcupacion = rige || escalera.status === "ENDED";

  return (
    <table className="w-full min-w-[420px] text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
          <th className="py-2 pr-3">Escalón</th>
          <th className="py-2 pr-3">Precio</th>
          <th className="py-2 pr-3">Pacientes nuevos</th>
          <th className="py-2">Estado</th>
        </tr>
      </thead>
      <tbody>
        {escalera.tiers.map((tier) => {
          const vigente = rige && tier.id === escalera.escalonVigenteId;
          const lleno = tier.seatsTaken >= tier.capacity;

          return (
            <tr key={tier.id} className="border-b border-slate-100">
              <td className="py-2 pr-3 text-slate-700">{tier.position}</td>
              <td className="py-2 pr-3 font-semibold text-slate-900">{formatCRC(tier.price)}</td>
              <td className="py-2 pr-3 text-slate-700">
                {conOcupacion ? `${tier.seatsTaken} de ${tier.capacity}` : tier.capacity}
              </td>
              <td className="py-2 text-xs">
                {!rige ? (
                  <span className="text-slate-500">—</span>
                ) : vigente ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">Rige ahora</span>
                ) : lleno ? (
                  <span className="text-slate-500">Completo</span>
                ) : (
                  <span className="text-slate-500">Próximo</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

"use client";

// Tarifas del profesional: cuánto cobra por cada combinación de tipo de consulta,
// lugar y franja. El profesional propone y un admin aprueba, así que acá se
// distingue siempre el precio vigente del que está en revisión.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { proposeRate, deleteRate } from "@/actions/practice-actions";
import { modalityLabel } from "@/lib/rates";
import { formatCRC as formatCRCBase } from "@/lib/service-pricing";

// Formato compartido; este componente muestra "—" cuando no hay monto.
const formatCRC = (value) => formatCRCBase(value, { vacio: "—" });


const ANY = "";


function StatusChip({ status }) {
  const styles = {
    APPROVED: "bg-emerald-100 text-emerald-800",
    PENDING: "bg-amber-100 text-amber-800",
    REJECTED: "bg-rose-100 text-rose-800",
  };
  const labels = { APPROVED: "Vigente", PENDING: "En revisión", REJECTED: "Rechazada" };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || "bg-slate-100 text-slate-700"}`}>
      {labels[status] || status}
    </span>
  );
}

export default function RatesManager({ rates = [], assignments = [], locations = [], timeBands = [] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    serviceId: assignments[0]?.serviceId || "",
    locationId: ANY,
    timeBandId: ANY,
    price: "",
  });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [isPending, startTransition] = useTransition();

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const grouped = useMemo(() => {
    const map = new Map();
    for (const rate of rates) {
      const title = rate.assignment?.service?.title || "Consulta";
      if (!map.has(title)) map.set(title, []);
      map.get(title).push(rate);
    }
    return [...map.entries()];
  }, [rates]);

  const onSubmit = (event) => {
    event.preventDefault();
    setMsg({ type: "", text: "" });

    startTransition(async () => {
      const res = await proposeRate({
        serviceId: form.serviceId,
        locationId: form.locationId || null,
        timeBandId: form.timeBandId || null,
        price: Number(form.price),
      });

      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setForm((prev) => ({ ...prev, price: "" }));
      setMsg({
        type: "ok",
        text: res?.unchanged
          ? "Esa tarifa ya estaba vigente con ese monto."
          : "Tarifa enviada a revisión. Mientras tanto sigue rigiendo su precio aprobado anterior.",
      });
      router.refresh();
    });
  };

  const onDelete = (rate) => {
    startTransition(async () => {
      const res = await deleteRate(rate.id);
      if (res?.error) {
        setMsg({ type: "error", text: res.error });
        return;
      }
      setMsg({ type: "ok", text: "Tarifa eliminada." });
      router.refresh();
    });
  };

  if (assignments.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Tarifas</h2>
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Todavía no tiene tipos de consulta aprobados. Cuando un admin le apruebe al menos uno podrá
          cargar sus precios.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Tarifas</h2>
      <p className="mt-1 text-sm text-slate-600">
        Cargue un precio general por tipo de consulta y agregue filas solo donde cobre distinto. Cada
        precio lo revisa un administrador antes de entrar en vigencia.
      </p>

      {msg.text && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            msg.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {msg.text}
        </div>
      )}

      {grouped.length > 0 && (
        <div className="mt-5 space-y-5">
          {grouped.map(([title, list]) => (
            <div key={title}>
              <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-3">Lugar</th>
                      <th className="py-2 pr-3">Franja</th>
                      <th className="py-2 pr-3">Vigente</th>
                      <th className="py-2 pr-3">En revisión</th>
                      <th className="py-2 pr-3">Estado</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((rate) => (
                      <tr key={rate.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-800">
                          {rate.location ? (
                            <>
                              {rate.location.name}{" "}
                              <span className="text-xs text-slate-500">({modalityLabel(rate.location.modality)})</span>
                            </>
                          ) : (
                            <span className="text-slate-500">Cualquiera</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-slate-800">
                          {rate.timeBand ? (
                            <>
                              {rate.timeBand.name}{" "}
                              <span className="text-xs text-slate-500">
                                ({rate.timeBand.startTime}-{rate.timeBand.endTime})
                              </span>
                            </>
                          ) : (
                            <span className="text-slate-500">Cualquiera</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 font-semibold text-slate-900">{formatCRC(rate.approvedPrice)}</td>
                        <td className="py-2 pr-3 text-slate-600">
                          {rate.status === "PENDING" ? formatCRC(rate.proposedPrice) : "—"}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusChip status={rate.status} />
                          {rate.adminReviewNote && (
                            <div className="mt-1 text-xs text-slate-500">{rate.adminReviewNote}</div>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => onDelete(rate)}
                            className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium text-slate-800">Tipo de consulta</span>
          <select
            value={form.serviceId}
            onChange={(e) => setField("serviceId", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            required
          >
            {assignments.map((assignment) => (
              <option key={assignment.serviceId} value={assignment.serviceId}>
                {assignment.service?.title}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="font-medium text-slate-800">Precio (colones)</span>
          <input
            type="number"
            min="1"
            step="500"
            value={form.price}
            onChange={(e) => setField("price", e.target.value)}
            placeholder="40000"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            required
          />
        </label>

        <label className="text-sm">
          <span className="font-medium text-slate-800">Lugar</span>
          <select
            value={form.locationId}
            onChange={(e) => setField("locationId", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value={ANY}>Cualquiera</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name} ({modalityLabel(location.modality)})
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="font-medium text-slate-800">Franja horaria</span>
          <select
            value={form.timeBandId}
            onChange={(e) => setField("timeBandId", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
          >
            <option value={ANY}>Cualquiera</option>
            {timeBands.map((band) => (
              <option key={band.id} value={band.id}>
                {band.name} ({band.startTime}-{band.endTime})
              </option>
            ))}
          </select>
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "Enviando..." : "Enviar tarifa a revisión"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Se aplica la tarifa más específica: si define una para un lugar y franja concretos, esa gana
            sobre la general.
          </p>
        </div>
      </form>
    </section>
  );
}

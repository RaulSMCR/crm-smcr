"use client";

import { RECURRENCE_OPTIONS, RECURRENCE_RULES } from "@/lib/appointment-recurrence";

export default function RecurrenceFields({
  recurrenceRule,
  recurrenceCount,
  onRuleChange,
  onCountChange,
  compact = false,
}) {
  const isRecurring = recurrenceRule && recurrenceRule !== RECURRENCE_RULES.NONE;

  return (
    <div className={compact ? "space-y-3" : "mt-4 space-y-3"}>
      <div>
        <label className="block text-sm font-medium text-slate-800 mb-1">Recurrencia</label>
        <select
          value={recurrenceRule}
          onChange={(event) => onRuleChange(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {RECURRENCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isRecurring && (
        <div>
          <label className="block text-sm font-medium text-slate-800 mb-1">Cantidad de citas</label>
          <input
            type="number"
            min="2"
            max="12"
            value={recurrenceCount}
            onChange={(event) => onCountChange(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <p className="mt-1 text-xs text-slate-500">
            Puede programar entre 2 y 12 citas en la serie para dar continuidad al cuidado.
          </p>
        </div>
      )}
    </div>
  );
}


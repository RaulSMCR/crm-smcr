import { describe, expect, it } from "vitest";
import {
  median,
  annotateLeads,
  groupAttribution,
  totalsRow,
  monthsInRange,
  ORGANIC_KEY,
} from "../../src/lib/attribution.js";

const T0 = new Date("2026-07-10T00:00:00Z");
const plusDays = (d) => new Date(T0.getTime() + d * 86400000);

describe("median", () => {
  it("impar y par", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("vacío → null", () => {
    expect(median([])).toBeNull();
  });
});

describe("monthsInRange", () => {
  it("cubre los meses que toca el rango", () => {
    expect(monthsInRange(new Date("2026-06-20"), new Date("2026-08-05"))).toEqual([
      "2026-06", "2026-07", "2026-08",
    ]);
  });
});

describe("criterio de aceptación: 3 leads, distinto utm_source y estado", () => {
  // Lead A (meta): agendó y pagó su 1ª cita.
  // Lead B (google): agendó pero NO pagó.
  // Lead C (orgánico, sin userId): no agendó.
  const leads = [
    { id: "A", utmSource: "meta", utmCampaign: "julio", userId: "u1", createdAt: T0 },
    { id: "B", utmSource: "google", utmCampaign: "search", userId: "u2", createdAt: T0 },
    { id: "C", utmSource: null, utmCampaign: null, userId: null, createdAt: T0 },
  ];
  const apptsByUser = new Map([
    ["u1", [{ createdAt: plusDays(2), paymentStatus: "PARTIALLY_PAID" }]],
    ["u2", [{ createdAt: plusDays(1), paymentStatus: "UNPAID" }]],
  ]);

  const annotated = annotateLeads(leads, apptsByUser);
  const spend = new Map([["meta", 100000]]);
  const rows = groupAttribution(annotated, (l) => l.utmSource, spend);

  it("anota agendó/pagó/tiempo correctamente", () => {
    const a = annotated.find((l) => l.id === "A");
    expect(a.scheduled).toBe(true);
    expect(a.paid).toBe(true);
    expect(a.timeToScheduleMs).toBe(2 * 86400000);
    const b = annotated.find((l) => l.id === "B");
    expect(b.scheduled).toBe(true);
    expect(b.paid).toBe(false);
    const c = annotated.find((l) => l.id === "C");
    expect(c.scheduled).toBe(false);
  });

  it("agrupa por fuente con conteos y tasas correctas", () => {
    const meta = rows.find((r) => r.source === "meta");
    expect(meta.leads).toBe(1);
    expect(meta.scheduled).toBe(1);
    expect(meta.scheduleRate).toBe(1);
    expect(meta.paid).toBe(1);
    expect(meta.payRate).toBe(1);
    expect(meta.medianDays).toBe(2);
    expect(meta.cac).toBe(100000); // 100000 / 1 pagó

    const google = rows.find((r) => r.source === "google");
    expect(google.scheduled).toBe(1);
    expect(google.paid).toBe(0);
    expect(google.payRate).toBe(0);
    expect(google.medianDays).toBe(1);
    expect(google.cac).toBeNull(); // sin gasto cargado
  });

  it("los orgánicos son una fila propia al final (línea base)", () => {
    const last = rows[rows.length - 1];
    expect(last.isOrganic).toBe(true);
    expect(last.source).toBe(ORGANIC_KEY);
    expect(last.leads).toBe(1);
    expect(last.scheduled).toBe(0);
  });

  it("totales correctos", () => {
    const t = totalsRow(rows);
    expect(t.leads).toBe(3);
    expect(t.scheduled).toBe(2);
    expect(t.paid).toBe(1);
    expect(t.scheduleRate).toBeCloseTo(2 / 3);
    expect(t.payRate).toBe(0.5);
  });
});

describe("drill-down por campaña", () => {
  it("agrupa el subconjunto de una fuente por utm_campaign", () => {
    const leads = [
      { id: "A", utmSource: "meta", utmCampaign: "julio", userId: null, createdAt: T0 },
      { id: "B", utmSource: "meta", utmCampaign: "agosto", userId: null, createdAt: T0 },
    ];
    const annotated = annotateLeads(leads, new Map());
    const rows = groupAttribution(annotated, (l) => l.utmCampaign, new Map());
    expect(rows.map((r) => r.source).sort()).toEqual(["agosto", "julio"]);
    expect(rows.every((r) => r.leads === 1)).toBe(true);
  });
});

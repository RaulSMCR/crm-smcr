import { beforeEach, describe, expect, it, vi } from "vitest";

// Los módulos con red o con cliente real no se cargan: todo lo externo entra por `deps`.
vi.mock("@/lib/google", () => ({ getCalendarClient: vi.fn() }));
vi.mock("@/lib/qstash", () => ({ scheduleReminder: vi.fn() }));
vi.mock("@/lib/casos", () => ({ abrirCasoSiNoExiste: vi.fn() }));

const {
  crearAcuerdo,
  generarCitasDelAcuerdo,
  publicarAcuerdoPendiente,
  tareaDiariaDeAcuerdos,
  terminarAcuerdo,
} = await import("@/lib/acuerdos-de-atencion-server");

// ─── Base en memoria, con lo justo que usa el módulo ─────────────────────────

function cumple(fila, where = {}) {
  return Object.entries(where).every(([campo, cond]) => {
    const valor = fila[campo];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !cond.in.includes(valor)) return false;
      if ("not" in cond && valor === cond.not) return false;
      if ("gte" in cond && !(valor >= cond.gte)) return false;
      if ("gt" in cond && !(valor > cond.gt)) return false;
      if ("lt" in cond && !(valor < cond.lt)) return false;
      return true;
    }
    return valor === cond;
  });
}

function crearDb() {
  let n = 0;
  const id = (p) => `${p}-${++n}`;
  const tablas = { acuerdos: [], citas: [] };
  const conRelaciones = (a) => ({
    ...a,
    patient: { name: "Javier", email: "javier@example.com" },
    service: { title: "Psicoterapia" },
    professional: { googleRefreshToken: "rt", googleCalendarId: "consultorio", user: { name: "Raúl", email: "raul@example.com" } },
  });
  return {
    tablas,
    professionalProfile: {
      findUnique: async ({ where }) => ({ "pro-raul": { id: "pro-raul", slug: "raul-olmedo" }, "pro-otra": { id: "pro-otra", slug: "otra" } })[where.id] || null,
    },
    user: { findUnique: async ({ where }) => (where.id === "pac-1" ? { id: "pac-1", role: "USER", isActive: true } : null) },
    serviceAssignment: {
      findUnique: async () => ({ status: "APPROVED", service: { id: "svc-1", durationMin: 50, isActive: true } }),
    },
    practiceLocation: {
      findUnique: async () => ({ id: "loc-1", professionalId: "pro-raul", isActive: true, modality: "VIRTUAL", name: "Consulta virtual" }),
    },
    acuerdoDeAtencion: {
      create: async ({ data }) => { const fila = { id: id("acu"), gcalEventId: null, meetLink: null, generadoHasta: null, ...data }; tablas.acuerdos.push(fila); return { id: fila.id }; },
      findUnique: async ({ where }) => { const a = tablas.acuerdos.find((x) => x.id === where.id); return a ? conRelaciones(a) : null; },
      findMany: async ({ where }) => tablas.acuerdos.filter((a) => cumple(a, where)),
      update: async ({ where, data }) => { const a = tablas.acuerdos.find((x) => x.id === where.id); Object.assign(a, data); return conRelaciones(a); },
    },
    appointment: {
      findMany: async ({ where }) => tablas.citas.filter((c) => cumple(c, where)),
      create: async ({ data }) => {
        const choca = tablas.citas.some((c) => c.professionalId === data.professionalId && ["PENDING", "CONFIRMED"].includes(c.status) && c.date < data.endDate && c.endDate > data.date);
        if (choca) throw new Error('violates exclusion constraint "appointment_no_overlap"');
        const fila = { id: id("cita"), ...data };
        tablas.citas.push(fila);
        return { id: fila.id };
      },
      update: async ({ where, data }) => Object.assign(tablas.citas.find((c) => c.id === where.id), data),
      updateMany: async ({ where, data }) => { const filas = tablas.citas.filter((c) => cumple(c, where)); filas.forEach((c) => Object.assign(c, data)); return { count: filas.length }; },
    },
  };
}

function crearDeps() {
  return {
    publicarEnGoogle: vi.fn(async () => ({ gcalEventId: "serie1", meetLink: "https://meet.google.com/abc" })),
    cortarEnGoogle: vi.fn(async () => {}),
    scheduleReminder: vi.fn(async () => {}),
    abrirCaso: vi.fn(async () => ({ id: "caso-1" })),
  };
}

// Jueves 22-oct-2026, 10:00 CR. La primera sesión, el miércoles 28 a las 16:00 CR.
const AHORA = new Date("2026-10-22T16:00:00Z");
const DATOS = {
  professionalId: "pro-raul", patientId: "pac-1", serviceId: "svc-1", locationId: "loc-1",
  periodicidad: "WEEKLY", inicio: "2026-10-28T22:00:00Z", precioAcordado: 40000,
};

let db;
let deps;
beforeEach(() => {
  db = crearDb();
  deps = crearDeps();
});

describe("crearAcuerdo", () => {
  it("lo registra, abre el caso, publica UNA serie y genera citas confirmadas al precio acordado", async () => {
    const r = await crearAcuerdo(db, DATOS, { ahora: AHORA, deps });

    expect(r.ok).toBe(true);
    expect(deps.abrirCaso).toHaveBeenCalledOnce();
    expect(deps.publicarEnGoogle).toHaveBeenCalledOnce();
    // 8 semanas desde el 22-oct: sesiones del 28-oct al 16-dic.
    expect(r.creadas).toBe(8);
    const primera = db.tablas.citas[0];
    expect(primera).toMatchObject({
      status: "CONFIRMED", pricePaid: 40000, isFirstWithProfessional: false,
      gcalEventId: "serie1_20261028T220000Z", meetLink: "https://meet.google.com/abc", locationName: "Consulta virtual",
    });
    expect(primera.priceTierId).toBeUndefined();
    expect(primera.endDate.toISOString()).toBe("2026-10-28T22:50:00.000Z");
  });

  it("adopta una serie que ya está en Google: no publica otra y las citas apuntan a sus instancias", async () => {
    deps.verificarSerie = vi.fn(async () => ({ ok: true, gcalEventId: "vieja", meetLink: "https://meet.google.com/old" }));

    const r = await crearAcuerdo(db, { ...DATOS, serieGoogleId: "vieja" }, { ahora: AHORA, deps });

    expect(r).toMatchObject({ ok: true, serieAdoptada: true });
    expect(deps.verificarSerie.mock.calls[0][1]).toMatchObject({ serieId: "vieja", periodicidad: "WEEKLY" });
    expect(deps.publicarEnGoogle).not.toHaveBeenCalled();
    expect(db.tablas.citas[0]).toMatchObject({
      gcalEventId: "vieja_20261028T220000Z",
      meetLink: "https://meet.google.com/old",
    });
  });

  it("si la serie no se puede adoptar, no crea nada", async () => {
    deps.verificarSerie = vi.fn(async () => ({ ok: false, message: "La periodicidad no coincide." }));

    const r = await crearAcuerdo(db, { ...DATOS, serieGoogleId: "vieja" }, { ahora: AHORA, deps });

    expect(r).toMatchObject({ ok: false, code: "SERIE_NO_ADOPTABLE", message: "La periodicidad no coincide." });
    expect(db.tablas.acuerdos).toHaveLength(0);
    expect(deps.abrirCaso).not.toHaveBeenCalled();
  });

  it("no programa recordatorios de sesiones lejanas: esos los programa la tarea diaria", async () => {
    await crearAcuerdo(db, DATOS, { ahora: AHORA, deps });
    expect(deps.scheduleReminder).not.toHaveBeenCalled();
  });

  it("programa los de una sesión que la tarea ya no alcanza", async () => {
    await crearAcuerdo(db, { ...DATOS, inicio: "2026-10-23T22:00:00Z" }, { ahora: AHORA, deps });
    expect(deps.scheduleReminder).toHaveBeenCalledTimes(2);
    expect(deps.scheduleReminder.mock.calls.map((c) => c[0].type)).toEqual(["24h", "10m"]);
  });

  it("con la primera sesión hoy ya pasada, la registra efectuada y sigue confirmando las próximas", async () => {
    // Miércoles 21-oct a las 21:48 CR; la sesión fue a las 16:00 CR.
    const noche = new Date("2026-10-22T03:48:00Z");
    const r = await crearAcuerdo(db, { ...DATOS, inicio: "2026-10-21T22:00:00Z" }, { ahora: noche, deps });

    expect(r.ok).toBe(true);
    const [hoy, proxima] = db.tablas.citas;
    expect(hoy).toMatchObject({ status: "COMPLETED", paymentStatus: "UNPAID", pricePaid: 40000 });
    expect(hoy.date.toISOString()).toBe("2026-10-21T22:00:00.000Z");
    expect(proxima).toMatchObject({ status: "CONFIRMED" });
    expect(proxima.date.toISOString()).toBe("2026-10-28T22:00:00.000Z");
    // A la sesión pasada no se le programa ningún recordatorio.
    const recordadas = deps.scheduleReminder.mock.calls.map((c) => c[0].appointmentId);
    expect(recordadas).not.toContain(hoy.id);
  });

  it("solo lo puede usar el profesional gestionado", async () => {
    const r = await crearAcuerdo(db, { ...DATOS, professionalId: "pro-otra" }, { ahora: AHORA, deps });
    expect(r).toMatchObject({ ok: false, code: "ACUERDO_NO_PERMITIDO" });
    expect(db.tablas.acuerdos).toHaveLength(0);
  });

  it("rechaza datos inválidos sin crear nada", async () => {
    const r = await crearAcuerdo(db, { ...DATOS, precioAcordado: 0 }, { ahora: AHORA, deps });
    expect(r).toMatchObject({ ok: false, code: "ACUERDO_INVALIDO" });
    expect(db.tablas.acuerdos).toHaveLength(0);
  });

  it("si Google falla el acuerdo y las citas quedan, y la serie se publica después", async () => {
    deps.publicarEnGoogle.mockRejectedValueOnce(new Error("sin red"));
    const r = await crearAcuerdo(db, DATOS, { ahora: AHORA, deps });
    expect(r.google).toMatchObject({ publicado: false });
    expect(db.tablas.citas.every((c) => c.gcalEventId === null)).toBe(true);

    await publicarAcuerdoPendiente(db, r.acuerdoId, deps);
    expect(db.tablas.citas[1].gcalEventId).toBe("serie1_20261104T220000Z");
  });
});

describe("generarCitasDelAcuerdo", () => {
  it("no duplica: correrlo dos veces el mismo día no crea nada nuevo", async () => {
    const { acuerdoId } = await crearAcuerdo(db, DATOS, { ahora: AHORA, deps });
    const otra = await generarCitasDelAcuerdo(db, acuerdoId, AHORA);
    expect(otra.creadas).toBe(0);
    expect(db.tablas.citas).toHaveLength(8);
  });

  it("una semana después agrega solo la sesión nueva", async () => {
    const { acuerdoId } = await crearAcuerdo(db, DATOS, { ahora: AHORA, deps });
    const r = await generarCitasDelAcuerdo(db, acuerdoId, new Date("2026-10-29T16:00:00Z"));
    expect(r.creadas).toBe(1);
    expect(db.tablas.citas.at(-1).date.toISOString()).toBe("2026-12-23T22:00:00.000Z");
  });

  it("omite la sesión que choca con otra cita y sigue con las demás", async () => {
    db.tablas.citas.push({
      id: "otra", professionalId: "pro-raul", status: "CONFIRMED",
      date: new Date("2026-11-04T22:00:00Z"), endDate: new Date("2026-11-04T22:50:00Z"),
    });
    const r = await crearAcuerdo(db, DATOS, { ahora: AHORA, deps });
    expect(r.creadas).toBe(7);
    expect(r.omitidas.map((d) => d.toISOString())).toEqual(["2026-11-04T22:00:00.000Z"]);
  });
});

describe("tareaDiariaDeAcuerdos", () => {
  it("programa los recordatorios de pasado mañana, una vez por sesión", async () => {
    await crearAcuerdo(db, DATOS, { ahora: AHORA, deps });
    deps.scheduleReminder.mockClear();

    // Lunes 26-oct a las 05:30 CR: pasado mañana es el miércoles 28.
    const r = await tareaDiariaDeAcuerdos(db, { ahora: new Date("2026-10-26T11:30:00Z"), deps });
    expect(r.recordatorios).toBe(1);
    expect(deps.scheduleReminder).toHaveBeenCalledTimes(2);
    expect(deps.scheduleReminder.mock.calls[0][0].sendAt.toISOString()).toBe("2026-10-27T22:00:00.000Z");

    // El martes ya no la vuelve a programar.
    deps.scheduleReminder.mockClear();
    await tareaDiariaDeAcuerdos(db, { ahora: new Date("2026-10-27T11:30:00Z"), deps });
    expect(deps.scheduleReminder).not.toHaveBeenCalled();
  });
});

describe("terminarAcuerdo", () => {
  it("cancela las sesiones futuras sin tocar las pasadas y corta la serie en Google", async () => {
    const { acuerdoId } = await crearAcuerdo(db, DATOS, { ahora: AHORA, deps });
    const r = await terminarAcuerdo(db, acuerdoId, { motivo: "alta", ahora: new Date("2026-11-05T12:00:00Z"), deps });

    expect(r).toMatchObject({ ok: true, canceladas: 6, google: { cortado: true } });
    const [a, b, c] = db.tablas.citas;
    expect([a.status, b.status, c.status]).toEqual(["CONFIRMED", "CONFIRMED", "CANCELLED_BY_PRO"]);
    expect(c.cancelReason).toMatch(/alta/);
    expect(deps.cortarEnGoogle).toHaveBeenCalledOnce();

    // Terminado, la tarea diaria ya no genera.
    const tarea = await tareaDiariaDeAcuerdos(db, { ahora: new Date("2026-11-20T11:30:00Z"), deps });
    expect(tarea.creadas).toBe(0);
  });
});

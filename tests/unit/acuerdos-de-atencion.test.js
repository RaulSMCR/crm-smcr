import { describe, expect, it } from "vitest";
import {
  ESTADOS_ACUERDO,
  PERIODICIDADES,
  SEMANAS_GENERADAS,
  SLUG_QUE_GESTIONA_ACUERDOS,
  diaQueProgramaLaTarea,
  diasQueProgramaLaCreacion,
  estadoInicialDeSesion,
  idDeSesionEnGoogle,
  problemaDeAcuerdo,
  puedeGestionarAcuerdos,
  reglaDeGoogle,
  sesionesDelAcuerdo,
  ventanaPendiente,
} from "../../src/lib/acuerdos-de-atencion.js";
import { SLUG_PROFESIONAL_GESTIONADO } from "../../src/lib/pagos-manuales.js";

// Javier: miércoles 16:00 hora CR = 22:00 UTC. Las fechas van explícitas en UTC
// para que la prueba no dependa de la zona de la máquina.
const JAVIER = {
  periodicidad: PERIODICIDADES.WEEKLY,
  inicio: new Date("2026-10-28T22:00:00Z"),
  duracionMin: 50,
  fin: null,
};

const iso = (sesiones) => sesiones.map((s) => s.start.toISOString());

describe("quién gestiona acuerdos", () => {
  it("solo el profesional gestionado", () => {
    expect(SLUG_QUE_GESTIONA_ACUERDOS).toBe(SLUG_PROFESIONAL_GESTIONADO);
    expect(puedeGestionarAcuerdos("raul-olmedo")).toBe(true);
    expect(puedeGestionarAcuerdos("otra-persona")).toBe(false);
    expect(puedeGestionarAcuerdos(undefined)).toBe(false);
  });
});

describe("problemaDeAcuerdo", () => {
  const ahora = new Date("2026-10-22T12:00:00Z");
  const valido = { ...JAVIER, precioAcordado: 40000 };

  it("acepta un acuerdo completo y sin fin", () => {
    expect(problemaDeAcuerdo(valido, ahora)).toBeNull();
  });

  it("acepta una primera sesión que ya ocurrió, hasta 7 días atrás", () => {
    // Javier: la primera sesión fue a las 16:00 del mismo día en que se cargó.
    expect(problemaDeAcuerdo({ ...valido, inicio: "2026-10-21T22:00:00Z" }, new Date("2026-10-22T03:48:00Z"))).toBeNull();
    expect(problemaDeAcuerdo({ ...valido, inicio: "2026-10-15T12:00:00Z" }, ahora)).toBeNull();
  });

  it("rechaza lo incompleto o incoherente", () => {
    expect(problemaDeAcuerdo({ ...valido, periodicidad: "DAILY" }, ahora)).toMatch(/periodicidad/);
    expect(problemaDeAcuerdo({ ...valido, inicio: "2026-10-01T22:00:00Z" }, ahora)).toMatch(/7 días/);
    expect(problemaDeAcuerdo({ ...valido, duracionMin: 0 }, ahora)).toMatch(/duración/);
    expect(problemaDeAcuerdo({ ...valido, precioAcordado: 0 }, ahora)).toMatch(/precio/);
    expect(problemaDeAcuerdo({ ...valido, fin: "2026-10-01T00:00:00Z" }, ahora)).toMatch(/fin/);
  });
});

describe("sesionesDelAcuerdo", () => {
  it("semanal: los miércoles a las 16:00 CR con 50 minutos", () => {
    const sesiones = sesionesDelAcuerdo(JAVIER, {
      desde: new Date("2026-10-22T00:00:00Z"),
      hasta: new Date("2026-11-19T00:00:00Z"),
    });
    expect(iso(sesiones)).toEqual([
      "2026-10-28T22:00:00.000Z",
      "2026-11-04T22:00:00.000Z",
      "2026-11-11T22:00:00.000Z",
      "2026-11-18T22:00:00.000Z",
    ]);
    expect(sesiones[0].end.toISOString()).toBe("2026-10-28T22:50:00.000Z");
  });

  it("quincenal salta una semana", () => {
    const sesiones = sesionesDelAcuerdo(
      { ...JAVIER, periodicidad: PERIODICIDADES.BIWEEKLY },
      { desde: new Date("2026-10-22T00:00:00Z"), hasta: new Date("2026-12-01T00:00:00Z") },
    );
    expect(iso(sesiones)).toEqual(["2026-10-28T22:00:00.000Z", "2026-11-11T22:00:00.000Z", "2026-11-25T22:00:00.000Z"]);
  });

  it("empieza en `desde` aunque el acuerdo lleve años, sin perder el ritmo quincenal", () => {
    const sesiones = sesionesDelAcuerdo(
      { ...JAVIER, periodicidad: PERIODICIDADES.BIWEEKLY },
      { desde: new Date("2028-10-01T00:00:00Z"), hasta: new Date("2028-10-30T00:00:00Z") },
    );
    // 28-oct-2026 + 714 días (51 quincenas, con el 29 de febrero de 2028 en el
    // medio) = miércoles 11-oct-2028, y la siguiente el 25.
    expect(iso(sesiones)).toEqual(["2028-10-11T22:00:00.000Z", "2028-10-25T22:00:00.000Z"]);
  });

  it("mensual del día 31 omite los meses sin 31, como Google", () => {
    const sesiones = sesionesDelAcuerdo(
      { ...JAVIER, periodicidad: PERIODICIDADES.MONTHLY, inicio: new Date("2026-10-31T15:00:00Z") },
      { desde: new Date("2026-10-01T00:00:00Z"), hasta: new Date("2027-02-01T00:00:00Z") },
    );
    expect(iso(sesiones)).toEqual(["2026-10-31T15:00:00.000Z", "2026-12-31T15:00:00.000Z", "2027-01-31T15:00:00.000Z"]);
  });

  it("respeta la fecha de fin, inclusive", () => {
    const sesiones = sesionesDelAcuerdo(
      { ...JAVIER, fin: new Date("2026-11-11T22:00:00Z") },
      { desde: new Date("2026-10-22T00:00:00Z"), hasta: new Date("2027-01-01T00:00:00Z") },
    );
    expect(iso(sesiones)).toEqual(["2026-10-28T22:00:00.000Z", "2026-11-04T22:00:00.000Z", "2026-11-11T22:00:00.000Z"]);
  });

  it("no genera nada antes del inicio", () => {
    expect(sesionesDelAcuerdo(JAVIER, { desde: new Date("2026-10-01T00:00:00Z"), hasta: new Date("2026-10-28T21:00:00Z") })).toEqual([]);
  });
});

describe("Google", () => {
  it("una regla sin fin por periodicidad", () => {
    expect(reglaDeGoogle(JAVIER)).toEqual(["RRULE:FREQ=WEEKLY;WKST=MO"]);
    expect(reglaDeGoogle({ ...JAVIER, periodicidad: PERIODICIDADES.BIWEEKLY })).toEqual(["RRULE:FREQ=WEEKLY;INTERVAL=2;WKST=MO"]);
    expect(reglaDeGoogle({ ...JAVIER, periodicidad: PERIODICIDADES.MONTHLY })).toEqual(["RRULE:FREQ=MONTHLY"]);
    expect(reglaDeGoogle({ ...JAVIER, fin: new Date("2027-06-30T22:00:00Z") })).toEqual(["RRULE:FREQ=WEEKLY;WKST=MO;UNTIL=20270630T220000Z"]);
  });

  it("el id de cada sesión sigue la forma de las instancias de Google", () => {
    // Es la forma que se vio en el calendario real: <maestro>_20261028T220000Z.
    expect(idDeSesionEnGoogle("abc123", new Date("2026-10-28T22:00:00Z"))).toBe("abc123_20261028T220000Z");
    expect(idDeSesionEnGoogle(null, new Date())).toBeNull();
  });
});

describe("ventanaPendiente", () => {
  const ahora = new Date("2026-10-22T12:00:00Z");
  const activo = { ...JAVIER, estado: ESTADOS_ACUERDO.ACTIVO, generadoHasta: null };

  it("la primera vez arranca en el inicio y llega a las semanas configuradas", () => {
    const v = ventanaPendiente(activo, ahora);
    expect(v.desde.toISOString()).toBe("2026-10-28T22:00:00.000Z");
    expect(v.hasta.getTime() - ahora.getTime()).toBe(SEMANAS_GENERADAS * 7 * 24 * 3600 * 1000);
  });

  it("después sigue desde lo ya generado, sin repetir la última sesión", () => {
    const v = ventanaPendiente({ ...activo, generadoHasta: new Date("2026-12-16T22:00:00Z") }, ahora);
    expect(v.desde.getTime()).toBe(new Date("2026-12-16T22:00:00Z").getTime() + 1);
  });

  it("un acuerdo terminado no genera", () => {
    expect(ventanaPendiente({ ...activo, estado: ESTADOS_ACUERDO.TERMINADO }, ahora)).toBeNull();
  });
});

describe("estadoInicialDeSesion", () => {
  const ahora = new Date("2026-10-22T03:48:00Z");
  it("lo que ya empezó queda efectuado; lo que viene, confirmado", () => {
    expect(estadoInicialDeSesion(new Date("2026-10-21T22:00:00Z"), ahora)).toBe("COMPLETED");
    expect(estadoInicialDeSesion(new Date("2026-10-28T22:00:00Z"), ahora)).toBe("CONFIRMED");
  });
});

describe("recordatorios por día tico", () => {
  // 10:00 CR = 16:00 UTC; 05:30 CR = 11:30 UTC.
  it("la tarea diaria programa pasado mañana", () => {
    expect(diaQueProgramaLaTarea(new Date("2026-10-22T11:30:00Z"))).toBe("2026-10-24");
  });

  it("al crear, cubre lo que la tarea ya no alcanza", () => {
    expect(diasQueProgramaLaCreacion(new Date("2026-10-22T16:00:00Z"))).toEqual(["2026-10-22", "2026-10-23", "2026-10-24"]);
    // Antes de que corra la tarea de hoy, pasado mañana queda para ella.
    expect(diasQueProgramaLaCreacion(new Date("2026-10-22T10:00:00Z"))).toEqual(["2026-10-22", "2026-10-23"]);
  });

  it("de noche en CR el día sigue siendo el tico, no el UTC", () => {
    // 23:00 CR del 22 = 05:00 UTC del 23.
    expect(diaQueProgramaLaTarea(new Date("2026-10-23T05:00:00Z"))).toBe("2026-10-24");
  });
});

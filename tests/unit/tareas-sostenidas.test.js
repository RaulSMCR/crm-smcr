import { describe, it, expect } from "vitest";
import { calcularRacha, hoyCR, TAREAS, ZONAS, CADENCIAS } from "@/lib/tareas-sostenidas";

describe("calcularRacha", () => {
  it("cuenta días consecutivos hasta hoy", () => {
    expect(calcularRacha(["2026-08-20", "2026-08-19", "2026-08-18"], "2026-08-20")).toBe(3);
  });

  it("no se corta si hoy todavía no se marcó", () => {
    // El día no terminó. Mostrar cero a las nueve de la mañana castiga por no
    // haber escrito todavía, que es exactamente lo contrario de lo que la racha
    // debería producir.
    expect(calcularRacha(["2026-08-19", "2026-08-18"], "2026-08-20")).toBe(2);
  });

  it("se corta con un día salteado de por medio", () => {
    expect(calcularRacha(["2026-08-20", "2026-08-18", "2026-08-17"], "2026-08-20")).toBe(1);
  });

  it("funciona sin pasarle la fecha, usando el valor por defecto", () => {
    // Todos los demás casos pasan la fecha explícita, así que el parámetro por
    // defecto nunca se evaluaba y un ReferenceError ahí habría pasado los tests
    // sin que nadie lo notara. Es exactamente cómo se coló el bug de
    // `estadoDeVigencia()` en frases.js.
    expect(() => calcularRacha([])).not.toThrow();
    expect(calcularRacha([])).toBe(0);
    expect(calcularRacha([hoyCR()])).toBe(1);
  });

  it("devuelve cero si no hay nada", () => {
    expect(calcularRacha([], "2026-08-20")).toBe(0);
  });

  it("devuelve cero si la última vez fue hace más de un día", () => {
    expect(calcularRacha(["2026-08-15"], "2026-08-20")).toBe(0);
  });

  it("cruza el fin de mes sin perder la cuenta", () => {
    expect(calcularRacha(["2026-08-01", "2026-07-31", "2026-07-30"], "2026-08-01")).toBe(3);
  });

  it("cruza el fin de año", () => {
    expect(calcularRacha(["2027-01-01", "2026-12-31"], "2027-01-01")).toBe(2);
  });

  it("ignora fechas repetidas", () => {
    expect(calcularRacha(["2026-08-20", "2026-08-20", "2026-08-19"], "2026-08-20")).toBe(2);
  });
});

describe("hoyCR", () => {
  it("devuelve YYYY-MM-DD", () => {
    expect(hoyCR()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("usa la zona de Costa Rica y no la del servidor", () => {
    // A las 03:00 UTC del día 21 en Costa Rica (UTC-6) todavía es el 20. Si esto
    // se calculara en UTC, la racha se cortaría o se duplicaría según la hora a
    // la que alguien escriba.
    expect(hoyCR(new Date("2026-08-21T03:00:00Z"))).toBe("2026-08-20");
    expect(hoyCR(new Date("2026-08-21T07:00:00Z"))).toBe("2026-08-21");
  });
});

describe("catálogo de tareas", () => {
  it("no tiene claves repetidas", () => {
    expect(new Set(TAREAS.map((t) => t.clave)).size).toBe(TAREAS.length);
  });

  it("toda tarea tiene una cadencia válida y una zona donde mostrarse", () => {
    const validas = new Set(Object.values(CADENCIAS));
    const conZona = new Set(ZONAS.map((z) => z.cadencia));
    for (const t of TAREAS) {
      expect(validas.has(t.cadencia), `${t.clave} tiene cadencia ${t.cadencia}`).toBe(true);
      expect(conZona.has(t.cadencia), `${t.clave} no tiene zona`).toBe(true);
    }
  });

  it("ninguna tarea diaria es de medición", () => {
    // El principio del segmento: la frecuencia sigue a la velocidad de cambio
    // del fenómeno. Nada de lo que se mide cambia en un día.
    const diarias = TAREAS.filter((t) => t.cadencia === CADENCIAS.DIARIA);
    expect(diarias).toHaveLength(2);
    for (const t of diarias) {
      expect(t.clave).not.toMatch(/search_console|bing|baseline|corrida|metric/);
    }
  });
});

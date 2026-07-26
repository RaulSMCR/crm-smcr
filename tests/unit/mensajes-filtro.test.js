import { describe, it, expect } from "vitest";
import {
  ESTADOS,
  VENTANAS,
  listaDe,
  serializarLista,
  tieneFiltroDeCitas,
  estadosPara,
  construirFiltroDeCitas,
  describirFiltro,
} from "@/lib/mensajes-filtro";

const AHORA = new Date("2026-07-26T12:00:00Z");

describe("listas", () => {
  it("parsea texto separado por comas y tolera espacios", () => {
    expect(listaDe("a, b ,c")).toEqual(["a", "b", "c"]);
    expect(listaDe("")).toEqual([]);
    expect(listaDe(null)).toEqual([]);
  });

  it("acepta arreglos tal cual", () => {
    expect(listaDe(["x", "y"])).toEqual(["x", "y"]);
  });

  it("serializa quitando duplicados y devuelve null si queda vacía", () => {
    expect(serializarLista(["a", "b", "a"])).toBe("a,b");
    expect(serializarLista([])).toBeNull();
    expect(serializarLista(null)).toBeNull();
  });
});

describe("cuándo hay filtro de citas", () => {
  it("no lo hay sin criterios", () => {
    expect(tieneFiltroDeCitas({})).toBe(false);
    expect(tieneFiltroDeCitas({ ventana: VENTANAS.ANY })).toBe(false);
    expect(construirFiltroDeCitas({}, AHORA)).toBeNull();
  });

  it("lo hay con profesional, con servicio o con ventana acotada", () => {
    expect(tieneFiltroDeCitas({ profesionales: ["p1"] })).toBe(true);
    expect(tieneFiltroDeCitas({ servicios: ["s1"] })).toBe(true);
    expect(tieneFiltroDeCitas({ ventana: VENTANAS.UPCOMING })).toBe(true);
    expect(tieneFiltroDeCitas({ ventana: VENTANAS.PAST })).toBe(true);
  });
});

describe("estados según la ventana", () => {
  it("una cita futura es la que sigue en pie", () => {
    expect(estadosPara(VENTANAS.UPCOMING, false)).toEqual(ESTADOS.ACTIVAS);
  });

  it("una cita pasada es la que ocurrió", () => {
    expect(estadosPara(VENTANAS.PAST, false)).toEqual(ESTADOS.OCURRIDAS);
  });

  it("sin ventana cuentan las activas y las ocurridas", () => {
    const r = estadosPara(VENTANAS.ANY, false);
    expect(r).toEqual([...ESTADOS.ACTIVAS, ...ESTADOS.OCURRIDAS]);
    expect(r).not.toContain("CANCELLED_BY_PRO");
  });

  it("las canceladas se suman solo si se piden", () => {
    const r = estadosPara(VENTANAS.ANY, true);
    expect(r).toContain("CANCELLED_BY_USER");
    expect(r).toContain("CANCELLED_BY_PRO");
  });

  it("una cita futura cancelada nunca entra en UPCOMING", () => {
    // Avisar de una reagenda a quien ya canceló es ruido.
    const r = estadosPara(VENTANAS.UPCOMING, true);
    expect(r).toEqual(ESTADOS.ACTIVAS);
    expect(r).not.toContain("CANCELLED_BY_USER");
  });
});

describe("caso 1: el profesional se enferma", () => {
  it("acota a sus citas futuras todavía en pie", () => {
    const where = construirFiltroDeCitas(
      { profesionales: ["pro-1"], ventana: VENTANAS.UPCOMING },
      AHORA,
    );
    expect(where.professionalId).toEqual({ in: ["pro-1"] });
    expect(where.status).toEqual({ in: ["PENDING", "CONFIRMED"] });
    expect(where.date).toEqual({ gte: AHORA });
    expect(where.serviceId).toBeUndefined();
  });

  it("respeta el tope de días cuando se indica", () => {
    const where = construirFiltroDeCitas(
      { profesionales: ["pro-1"], ventana: VENTANAS.UPCOMING, ventanaDias: 7 },
      AHORA,
    );
    expect(where.date.gte).toBe(AHORA);
    expect(where.date.lte.toISOString().slice(0, 10)).toBe("2026-08-02");
  });

  it("ignora topes absurdos y no rompe", () => {
    const where = construirFiltroDeCitas(
      { profesionales: ["p"], ventana: VENTANAS.UPCOMING, ventanaDias: 0 },
      AHORA,
    );
    expect(where.date.lte).toBeUndefined();
  });

  it("lo describe en castellano", () => {
    const texto = describirFiltro(
      { profesionales: ["pro-1"], ventana: VENTANAS.UPCOMING, ventanaDias: 7 },
      { profesionales: { "pro-1": "Andrea Robles" } },
    );
    expect(texto).toBe("agendaron con Andrea Robles, con cita en los próximos 7 días");
  });
});

describe("caso 2: promoción de nutrición", () => {
  it("(a) los que ya agendaron ese servicio", () => {
    const where = construirFiltroDeCitas({ servicios: ["svc-nutri"] }, AHORA);
    expect(where.serviceId).toEqual({ in: ["svc-nutri"] });
    expect(where.date).toBeUndefined(); // sin ventana no se mira la fecha
  });

  it("(b) los que agendaron con esos profesionales, en cualquier servicio", () => {
    const where = construirFiltroDeCitas({ profesionales: ["n1", "n2"] }, AHORA);
    expect(where.professionalId).toEqual({ in: ["n1", "n2"] });
    expect(where.serviceId).toBeUndefined();
  });

  it("(c) el complemento se expresa negando, y el where no cambia", () => {
    // La negación se aplica sobre el conjunto resultante, no sobre la consulta:
    // el `where` sigue describiendo "quiénes SÍ", y el resolutor toma el resto.
    const conNegar = construirFiltroDeCitas({ servicios: ["svc-nutri"], negar: true }, AHORA);
    const sinNegar = construirFiltroDeCitas({ servicios: ["svc-nutri"] }, AHORA);
    expect(conNegar).toEqual(sinNegar);
  });

  it("describe la negación de forma legible", () => {
    const texto = describirFiltro(
      { servicios: ["svc-nutri"], negar: true },
      { servicios: { "svc-nutri": "Nutrición" } },
    );
    expect(texto).toBe("NO agendaron en Nutrición");
  });

  it("cruza profesional y servicio cuando se piden ambos", () => {
    const where = construirFiltroDeCitas(
      { profesionales: ["p1"], servicios: ["s1"] },
      AHORA,
    );
    expect(where.professionalId).toEqual({ in: ["p1"] });
    expect(where.serviceId).toEqual({ in: ["s1"] });
  });
});

describe("ventana pasada", () => {
  it("mira solo hacia atrás", () => {
    const where = construirFiltroDeCitas({ servicios: ["s"], ventana: VENTANAS.PAST }, AHORA);
    expect(where.date).toEqual({ lt: AHORA });
    expect(where.status).toEqual({ in: ESTADOS.OCURRIDAS });
  });

  it("puede incluir canceladas", () => {
    const where = construirFiltroDeCitas(
      { servicios: ["s"], ventana: VENTANAS.PAST, incluirCanceladas: true },
      AHORA,
    );
    expect(where.status.in).toContain("CANCELLED_BY_PRO");
  });
});

describe("descripción", () => {
  it("devuelve null cuando no hay filtro", () => {
    expect(describirFiltro({})).toBeNull();
  });

  it("cae al id cuando no conoce el nombre", () => {
    expect(describirFiltro({ servicios: ["abc"] })).toBe("agendaron en abc");
  });
});

import { describe, it, expect } from "vitest";
import {
  AUDIENCIAS,
  PRIMER_DIA,
  ULTIMO_DIA,
  HORA_DE_CAMBIO,
  fechaVigente,
  fechaHoy,
  diasAPreparar,
  sesionDe,
  sesionDelDia,
  diaDeFrases,
  resumenDia,
  resumenRango,
  calorDelMes,
  diasDeAltaExposicion,
  fraseDeIndice,
  fuentesPorImpacto,
  buscarFrases,
  facetasDelCorpus,
  totalFrases,
  totalFuentes,
  existeDia,
} from "@/lib/frases";

describe("integridad del dataset", () => {
  it("cubre la ventana completa del corpus", () => {
    expect(PRIMER_DIA).toBe("2026-08-15");
    expect(ULTIMO_DIA).toBe("2027-08-14");
    expect(resumenRango(PRIMER_DIA, ULTIMO_DIA)).toHaveLength(365);
  });

  it("conserva el corpus desduplicado", () => {
    expect(totalFrases()).toBe(1112);
    expect(totalFuentes()).toBe(486);
  });

  it("da 16 candidatas por día en todos los días del año", () => {
    for (const resumen of resumenRango(PRIMER_DIA, ULTIMO_DIA)) {
      const dia = diaDeFrases(resumen.fecha);
      expect(dia.candidatas, `${resumen.fecha}`).toHaveLength(16);
    }
  });

  it("cubre las 8 audiencias con ancla y contrapunto", () => {
    const dia = diaDeFrases("2026-10-10");
    for (const audiencia of AUDIENCIAS) {
      const suyas = dia.candidatas.filter((c) => c.audiencia === audiencia.id);
      expect(suyas.map((c) => c.rol).sort()).toEqual(["ancla", "contrapunto"]);
    }
  });

  it("toda candidata conserva autor y obra", () => {
    for (const c of diaDeFrases("2026-12-24").candidatas) {
      expect(c.autor).toBeTruthy();
      expect(c.obra).toBeTruthy();
      expect(c.claveFuente).toContain(c.autor);
    }
  });

  it("no inventa días fuera de la ventana", () => {
    expect(existeDia("2026-08-14")).toBe(false);
    expect(existeDia("2027-08-15")).toBe(false);
    expect(diaDeFrases("2027-08-15")).toBeNull();
    expect(resumenDia("2026-08-14")).toBeNull();
  });

  it("trae los metadatos de la fecha", () => {
    const madre = resumenDia("2026-08-15");
    expect(madre.evento).toContain("Día de la Madre");
    expect(madre.calor).toBe(9);
    expect(madre.ventanaSensible).toBe(true);
    expect(madre.temasDominantes).toContain("familia");
    expect(madre.vector).toBeTruthy();
  });

  it("conserva las 67 ventanas sensibles y los 30 días de alta exposición", () => {
    const todos = resumenRango(PRIMER_DIA, ULTIMO_DIA);
    expect(todos.filter((d) => d.ventanaSensible)).toHaveLength(67);
    expect(diasDeAltaExposicion(PRIMER_DIA, ULTIMO_DIA)).toHaveLength(30);
  });

  it("mantiene el calor en la escala 0-10", () => {
    for (const d of resumenRango(PRIMER_DIA, ULTIMO_DIA)) {
      expect(d.calor).toBeGreaterThanOrEqual(0);
      expect(d.calor).toBeLessThanOrEqual(10);
    }
  });
});

describe("la frase cambia a las 6:00 de Costa Rica", () => {
  it("a las 5 a.m. todavía está publicada la del día anterior", () => {
    // 11:30 UTC = 5:30 en Costa Rica (UTC-6).
    expect(fechaVigente(new Date("2026-10-10T11:30:00Z"))).toBe("2026-10-09");
  });

  it("a las 6 a.m. en punto ya cambió", () => {
    expect(fechaVigente(new Date("2026-10-10T12:00:00Z"))).toBe("2026-10-10");
  });

  it("cruza la medianoche sin adelantar el día", () => {
    // 00:30 UTC del 11 = 18:30 del 10 en Costa Rica: sigue siendo el día 10.
    expect(fechaVigente(new Date("2026-10-11T00:30:00Z"))).toBe("2026-10-10");
    expect(fechaHoy(new Date("2026-10-11T00:30:00Z"))).toBe("2026-10-10");
  });

  it("entre medianoche y las 6 la fecha de calendario y la vigente difieren", () => {
    const ahora = new Date("2026-10-10T08:00:00Z"); // 2:00 a.m. en CR
    expect(fechaHoy(ahora)).toBe("2026-10-10");
    expect(fechaVigente(ahora)).toBe("2026-10-09");
    expect(HORA_DE_CAMBIO).toBe(6);
  });
});

describe("anticipación de un día y viernes largo", () => {
  it("de lunes a jueves se trabaja el día siguiente", () => {
    expect(diasAPreparar("2026-08-17")).toEqual(["2026-08-18"]); // lunes → martes
    expect(diasAPreparar("2026-08-20")).toEqual(["2026-08-21"]); // jueves → viernes
  });

  it("el viernes cubre sábado, domingo y lunes", () => {
    expect(diasAPreparar("2026-08-21")).toEqual(["2026-08-22", "2026-08-23", "2026-08-24"]);
  });

  it("sábado y domingo no tienen sesión", () => {
    expect(diasAPreparar("2026-08-22")).toEqual([]);
    expect(diasAPreparar("2026-08-23")).toEqual([]);
  });

  it("sesionDe es la inversa exacta de diasAPreparar", () => {
    let fecha = "2026-08-15";
    while (fecha < "2027-08-14") {
      for (const objetivo of diasAPreparar(fecha)) {
        expect(sesionDe(objetivo), `${objetivo} debía decidirse el ${fecha}`).toBe(fecha);
      }
      const f = new Date(`${fecha}T12:00:00Z`);
      f.setUTCDate(f.getUTCDate() + 1);
      fecha = f.toISOString().slice(0, 10);
    }
  });

  it("todo día del año tiene exactamente una sesión que lo decide", () => {
    expect(sesionDe("2026-08-22")).toBe("2026-08-21"); // sábado → viernes
    expect(sesionDe("2026-08-23")).toBe("2026-08-21"); // domingo → viernes
    expect(sesionDe("2026-08-24")).toBe("2026-08-21"); // lunes → viernes
    expect(sesionDe("2026-08-25")).toBe("2026-08-24"); // martes → lunes
  });
});

describe("sesionDelDia", () => {
  it("un jueves pide solo el viernes", () => {
    const sesion = sesionDelDia("2026-08-20");
    expect(sesion.pendientes.map((p) => p.fecha)).toEqual(["2026-08-20", "2026-08-21"]);
  });

  it("un viernes pide sábado, domingo y lunes", () => {
    const sesion = sesionDelDia("2026-08-21", new Set(["2026-08-21"]));
    expect(sesion.pendientes.map((p) => p.fecha)).toEqual([
      "2026-08-22",
      "2026-08-23",
      "2026-08-24",
    ]);
    expect(sesion.atrasadas).toBe(0);
  });

  it("no deja caer el fin de semana si el viernes no se trabajó", () => {
    const sabado = sesionDelDia("2026-08-22", new Set(["2026-08-22"]));
    const fechas = sabado.pendientes.map((p) => p.fecha);
    expect(fechas).toContain("2026-08-23");
    expect(fechas).toContain("2026-08-24");
    expect(sabado.pendientes.find((p) => p.fecha === "2026-08-23").atrasada).toBe(true);
  });

  it("marca como atrasado y en vivo el día de hoy sin elegir", () => {
    const hoy = sesionDelDia("2026-09-10");
    const deHoy = hoy.pendientes.find((p) => p.fecha === "2026-09-10");
    expect(deHoy.enVivo).toBe(true);
    expect(deHoy.atrasada).toBe(true);
  });

  it("no pide nada cuando todo está resuelto", () => {
    const resueltas = new Set(
      resumenRango("2026-08-20", "2026-09-01").map((d) => d.fecha),
    );
    expect(sesionDelDia("2026-08-20", resueltas).pendientes).toHaveLength(0);
  });

  it("no propone fechas fuera del corpus al final de la ventana", () => {
    for (const p of sesionDelDia("2027-08-12").pendientes) {
      expect(p.fecha <= ULTIMO_DIA).toBe(true);
    }
  });

  it("adjunta el resumen para poder decidir sin otra consulta", () => {
    const p = sesionDelDia("2026-10-09").pendientes.find((x) => x.fecha === "2026-10-10");
    expect(p.resumen.evento).toBeTruthy();
    expect(p.resumen.calor).toBeGreaterThan(0);
  });
});

describe("búsqueda para sustituir", () => {
  it("filtra por texto", () => {
    const r = buscarFrases({ texto: "duelo", limite: 5 });
    expect(r.length).toBeGreaterThan(0);
    for (const f of r) expect(f.texto.toLowerCase()).toContain("duelo");
  });

  it("filtra por autor y por tema", () => {
    const porAutor = buscarFrases({ autor: "Galeano", limite: 5 });
    for (const f of porAutor) expect(f.autor).toContain("Galeano");

    const porTema = buscarFrases({ tema: "dinero", limite: 5 });
    for (const f of porTema) expect(f.temas).toContain("dinero");
  });

  it("filtra por largo, que es el problema de las historias", () => {
    const cortas = buscarFrases({ largoMaximo: 100, limite: 20 });
    for (const f of cortas) expect(f.largo).toBeLessThanOrEqual(100);
  });

  it("respeta el límite y devuelve vacío sin coincidencias", () => {
    expect(buscarFrases({ limite: 7 })).toHaveLength(7);
    expect(buscarFrases({ texto: "zzzzqqq" })).toHaveLength(0);
  });

  it("expone las facetas reales del corpus", () => {
    const f = facetasDelCorpus();
    expect(f.temas).toHaveLength(19);
    expect(f.autores).toHaveLength(40);
    expect(f.categorias.length).toBeGreaterThan(4);
  });
});

describe("fuentes", () => {
  it("ordena por impacto y suma las 5.840 asignaciones", () => {
    const fuentes = fuentesPorImpacto();
    expect(fuentes).toHaveLength(486);
    expect(fuentes[0].usos).toBeGreaterThan(fuentes[485].usos);
    expect(fuentes.reduce((n, f) => n + f.usos, 0)).toBe(5840);
  });

  it("cada fuente tiene clave estable para cruzar con su verificación", () => {
    for (const f of fuentesPorImpacto().slice(0, 20)) {
      expect(f.clave).toBe(`${f.autor} ${f.obra}`);
    }
  });

  it("la clave de una frase coincide con la de su fuente", () => {
    const frase = fraseDeIndice(0);
    expect(frase.claveFuente).toBe(`${frase.autor} ${frase.obra}`);
  });
});

describe("calor mensual para el mapa térmico", () => {
  it("resume noviembre 2026 como el mes más caliente", () => {
    const nov = calorDelMes(2026, 11);
    expect(nov.dias).toHaveLength(30);
    expect(nov.promedio).toBeGreaterThan(7);
    expect(nov.maximo).toBeGreaterThanOrEqual(9);
  });

  it("agosto 2026 arranca el día 15", () => {
    const ago = calorDelMes(2026, 8);
    expect(ago.dias).toHaveLength(17);
    expect(ago.dias[0].fecha).toBe("2026-08-15");
  });

  it("devuelve null fuera de la ventana", () => {
    expect(calorDelMes(2025, 1)).toBeNull();
  });
});

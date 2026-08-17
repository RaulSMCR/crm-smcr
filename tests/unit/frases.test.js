import { describe, it, expect } from "vitest";
import {
  AUDIENCIAS,
  PRIMER_DIA,
  ULTIMO_DIA,
  HORA_DE_CAMBIO,
  VENTANA_REPETICION,
  alternativasParaAudiencia,
  aparicionesDeFrase,
  estadoDeStock,
  perfilDeAudiencia,
  repeticionesCercanas,
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

describe("una elección por audiencia, no una por día", () => {
  it("cada audiencia trae sus 2 candidatas propias y distinguibles", () => {
    const dia = diaDeFrases("2026-10-10");
    for (const audiencia of AUDIENCIAS) {
      const suyas = dia.candidatas.filter((c) => c.audiencia === audiencia.id);
      expect(suyas, `${audiencia.id} sin candidatas`).toHaveLength(2);
      // El slot identifica la candidata dentro de la audiencia: es la clave que
      // usa el radio de la interfaz, y tiene que ser única por audiencia.
      expect(new Set(suyas.map((c) => c.slot)).size).toBe(2);
    }
  });

  it("el par (audiencia, slot) identifica una candidata sin ambigüedad", () => {
    const dia = diaDeFrases("2026-12-24");
    const claves = dia.candidatas.map((c) => `${c.audiencia}:${c.slot}`);
    expect(new Set(claves).size).toBe(16);
  });

  it("audiencias distintas reciben frases distintas el mismo día", () => {
    // Si todas las audiencias compartieran frase, elegir por audiencia no
    // tendría sentido. El corpus las diferencia por tono y perfil.
    const dia = diaDeFrases("2026-10-10");
    const indices = new Set(dia.candidatas.map((c) => c.indice));
    expect(indices.size).toBeGreaterThan(8);
  });

  it("registrados y no registrados están ambos representados cada día", () => {
    const dia = diaDeFrases("2027-01-04");
    expect(dia.candidatas.some((c) => c.registro === true)).toBe(true);
    expect(dia.candidatas.some((c) => c.registro === false)).toBe(true);
  });
});

describe("integridad del dataset", () => {
  it("cubre la ventana completa del corpus", () => {
    expect(PRIMER_DIA).toBe("2026-08-15");
    expect(ULTIMO_DIA).toBe("2027-08-14");
    expect(resumenRango(PRIMER_DIA, ULTIMO_DIA)).toHaveLength(365);
  });

  // Huella del corpus. Estas cifras cambian cuando se regenera el dataset desde
  // la base de conocimiento; el test es a propósito estricto, para que un
  // reemplazo silencioso del corpus no pase inadvertido. Al regenerar, se
  // actualizan acá y solo acá.
  it("coincide con la huella del corpus vigente", () => {
    expect(totalFrases()).toBe(1145);
    expect(totalFuentes()).toBe(494);
    expect(facetasDelCorpus().autores).toHaveLength(42);
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

  it("conserva las ventanas sensibles y los días de alta exposición", () => {
    const todos = resumenRango(PRIMER_DIA, ULTIMO_DIA);
    expect(todos.filter((d) => d.ventanaSensible)).toHaveLength(68);
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
    expect(f.temas).toHaveLength(20);
    expect(f.categorias.length).toBeGreaterThan(4);
  });

  it("incorpora el eje de ejercicio que trajeron Sloterdijk y Ortega", () => {
    const f = facetasDelCorpus();
    expect(f.temas).toContain("ejercicio");
    expect(f.autores).toContain("Peter Sloterdijk");
    expect(f.autores).toContain("José Ortega y Gasset");
    // El tema tiene material real detrás, no es una etiqueta huérfana.
    expect(buscarFrases({ tema: "ejercicio", limite: 5 }).length).toBeGreaterThan(0);
  });
});

describe("fuentes", () => {
  it("ordena por impacto y suma las 5.840 asignaciones", () => {
    const fuentes = fuentesPorImpacto();
    expect(fuentes).toHaveLength(totalFuentes());
    expect(fuentes[0].usos).toBeGreaterThan(fuentes[fuentes.length - 1].usos);
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

describe("repetición visible al revisar", () => {
  // El corpus reparte 5.840 asignaciones entre ~1.100 frases: cada una sale unas
  // cinco veces al año y eso no se puede evitar. Lo que sí se puede es avisar
  // cuándo la reaparición cae tan cerca que se nota al revisar día por día.
  it("cada candidata trae dónde más sale la misma frase cerca", () => {
    const dia = diaDeFrases("2026-12-24");
    for (const c of dia.candidatas) expect(Array.isArray(c.repeticiones)).toBe(true);
    expect(dia.candidatas.some((c) => c.repeticiones.length)).toBe(true);
  });

  it("no cuenta su propia casilla como repetición", () => {
    const dia = diaDeFrases("2026-12-24");
    for (const c of dia.candidatas) {
      const propia = c.repeticiones.filter(
        (r) => r.fecha === dia.fecha && r.audiencia === c.audiencia,
      );
      expect(propia).toHaveLength(0);
    }
  });

  it("las reapariciones que reporta existen de verdad en el calendario", () => {
    const dia = diaDeFrases("2026-11-02");
    for (const c of dia.candidatas) {
      for (const r of c.repeticiones) {
        const otro = diaDeFrases(r.fecha);
        const ahi = otro.candidatas.filter((x) => x.audiencia === r.audiencia);
        expect(ahi.some((x) => x.indice === c.indice)).toBe(true);
        expect(Math.abs(r.distancia)).toBeLessThanOrEqual(VENTANA_REPETICION);
      }
    }
  });

  it("la ventana acota qué cuenta como cercano", () => {
    const c = diaDeFrases("2026-12-24").candidatas.find((x) => x.repeticiones.length);
    expect(repeticionesCercanas("2026-12-24", c.indice, { audiencia: c.audiencia })).toEqual(
      c.repeticiones,
    );
    // Con ventana 0 solo queda lo del mismo día en otras audiencias.
    const mismoDia = repeticionesCercanas("2026-12-24", c.indice, {
      audiencia: c.audiencia,
      ventana: 0,
    });
    expect(mismoDia.every((r) => r.fecha === "2026-12-24")).toBe(true);
  });

  it("una frase sabe todos los lugares del año donde el corpus la coloca", () => {
    const dia = diaDeFrases("2026-12-24");
    const c = dia.candidatas[0];
    const apariciones = aparicionesDeFrase(c.indice);
    expect(apariciones.length).toBeGreaterThan(0);
    expect(apariciones).toContainEqual({
      fecha: "2026-12-24",
      audiencia: c.audiencia,
      slot: c.slot,
    });
  });
});

describe("alternativas por audiencia", () => {
  const FECHA = "2026-12-24";

  it("nunca propone las que el día ya tiene asignadas", () => {
    const dia = diaDeFrases(FECHA);
    const delDia = new Set(dia.candidatas.map((c) => c.indice));
    const { opciones } = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MR26" });
    expect(opciones.length).toBeGreaterThan(0);
    for (const o of opciones) expect(delDia.has(o.indice)).toBe(false);
  });

  it("respeta lo que se le pide excluir", () => {
    const primera = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MR26" });
    const excluir = primera.opciones.map((o) => o.indice);
    const segunda = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MR26", excluir });
    for (const o of segunda.opciones) expect(excluir).not.toContain(o.indice);
  });

  it("reparte entre autores: una tanda no repite autor", () => {
    // Sin el reparto, las mejores seis salen casi siempre de los dos o tres
    // autores más presentes del corpus y la propuesta se ve tan monótona como
    // el problema que viene a resolver.
    for (const audiencia of ["MR26", "HNJ"]) {
      const { opciones } = alternativasParaAudiencia({ fecha: FECHA, audiencia });
      expect(new Set(opciones.map((o) => o.autor)).size).toBe(opciones.length);
    }
  });

  it("la tanda siguiente no repite lo ya mostrado", () => {
    const p0 = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MRJ", pagina: 0 });
    const p1 = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MRJ", pagina: 1 });
    expect(p0.hayMas).toBe(true);
    const vistos = new Set(p0.opciones.map((o) => o.indice));
    for (const o of p1.opciones) expect(vistos.has(o.indice)).toBe(false);
  });

  it("propone el tono de la audiencia y no uno genérico", () => {
    // La afinidad se mide contra la distribución tonal real de cada audiencia en
    // el corpus: lo que le proponemos a las no registradas calza mejor con su
    // propio perfil (interpelación) que con el de las registradas (homeostasis).
    const media = (opciones, perfil) =>
      opciones.reduce((n, o) => n + (perfil.categorias.get(o.categoria) || 0), 0) / opciones.length;

    const noRegistradas = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MN26" }).opciones;
    expect(media(noRegistradas, perfilDeAudiencia("MN26"))).toBeGreaterThan(
      media(noRegistradas, perfilDeAudiencia("MR26")),
    );

    const registradas = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MR26" }).opciones;
    expect(media(registradas, perfilDeAudiencia("MR26"))).toBeGreaterThan(
      media(registradas, perfilDeAudiencia("MN26")),
    );
  });

  it("evita las frases que vuelven a salir en fechas cercanas", () => {
    // Es la razón de ser de todo esto: sustituir no puede traer material que el
    // mismo revisor va a ver otra vez la semana entrante.
    const dia = diaDeFrases(FECHA);
    const repetidasEnElDia = dia.candidatas.filter((c) => c.repeticiones.length).length;
    expect(repetidasEnElDia).toBeGreaterThan(0);

    const { opciones } = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MR26" });
    const repetidasPropuestas = opciones.filter((o) => o.repeticiones.length).length;
    expect(repetidasPropuestas / opciones.length).toBeLessThan(
      repetidasEnElDia / dia.candidatas.length,
    );
  });

  it("explica por qué propone cada frase", () => {
    const { opciones } = alternativasParaAudiencia({ fecha: FECHA, audiencia: "HR26" });
    expect(opciones.every((o) => Array.isArray(o.porQue))).toBe(true);
    expect(opciones.some((o) => o.porQue.some((m) => m.startsWith("tema del día")))).toBe(true);
  });

  it("es determinista: la misma pregunta da la misma respuesta", () => {
    const a = alternativasParaAudiencia({ fecha: FECHA, audiencia: "HRJ" });
    const b = alternativasParaAudiencia({ fecha: FECHA, audiencia: "HRJ" });
    expect(a.opciones.map((o) => o.indice)).toEqual(b.opciones.map((o) => o.indice));
  });

  it("audiencias distintas reciben propuestas distintas el mismo día", () => {
    const registrada = alternativasParaAudiencia({ fecha: FECHA, audiencia: "MR26" }).opciones;
    const noRegistrada = alternativasParaAudiencia({ fecha: FECHA, audiencia: "HNJ" }).opciones;
    const comunes = registrada.filter((o) => noRegistrada.some((x) => x.indice === o.indice));
    expect(comunes.length).toBeLessThan(registrada.length);
  });

  it("no propone nada fuera del calendario ni para una audiencia inventada", () => {
    expect(alternativasParaAudiencia({ fecha: "2030-01-01", audiencia: "MR26" }).opciones).toEqual([]);
    expect(alternativasParaAudiencia({ fecha: FECHA, audiencia: "XX99" }).opciones).toEqual([]);
  });
});

describe("prohibición de repetir: el día se recalcula", () => {
  const FECHA = "2026-10-10";

  it("una frase quemada no vuelve a aparecer como candidata", () => {
    const original = diaDeFrases(FECHA);
    const quemada = original.candidatas[0].indice;
    const recalculado = diaDeFrases(FECHA, { usadas: new Set([quemada]) });
    expect(recalculado.candidatas.some((c) => c.indice === quemada)).toBe(false);
  });

  it("el día conserva sus 16 candidatas y sus 2 por audiencia", () => {
    const usadas = new Set(diaDeFrases(FECHA).candidatas.map((c) => c.indice));
    const recalculado = diaDeFrases(FECHA, { usadas });
    expect(recalculado.candidatas).toHaveLength(16);
    for (const audiencia of AUDIENCIAS) {
      const suyas = recalculado.candidatas.filter((c) => c.audiencia === audiencia.id);
      expect(suyas, `${audiencia.id} sin candidatas`).toHaveLength(2);
      expect(new Set(suyas.map((c) => c.slot)).size).toBe(2);
    }
  });

  it("el reemplazo viene marcado y dice a quién sustituye", () => {
    const original = diaDeFrases(FECHA);
    const quemada = original.candidatas[0];
    const recalculado = diaDeFrases(FECHA, { usadas: new Set([quemada.indice]) });
    const repuesta = recalculado.candidatas.find(
      (c) => c.audiencia === quemada.audiencia && c.slot === quemada.slot,
    );
    expect(repuesta.reemplazo).toBeTruthy();
    expect(repuesta.reemplazo.autorOriginal).toBe(quemada.autor);
    expect(repuesta.indice).not.toBe(quemada.indice);
    // Las que no se tocaron no quedan marcadas.
    const intacta = recalculado.candidatas.find((c) => c.indice === original.candidatas[3].indice);
    expect(intacta.reemplazo).toBeNull();
  });

  it("no coloca la misma frase dos veces el mismo día", () => {
    const usadas = new Set(diaDeFrases(FECHA).candidatas.map((c) => c.indice));
    const recalculado = diaDeFrases(FECHA, { usadas });
    const indices = recalculado.candidatas.map((c) => c.indice);
    expect(new Set(indices).size).toBe(indices.length);
  });

  it("la elección ya guardada sigue visible en su audiencia y bloqueada en las otras", () => {
    // Su propia casilla la conserva —si no, la elección guardada desaparecería
    // de su propia lista— pero para las otras siete está quemada como cualquiera.
    const original = diaDeFrases(FECHA);
    const guardada = original.candidatas.find((c) => c.audiencia === "MR26" && c.slot === 1);
    const recalculado = diaDeFrases(FECHA, {
      usadas: new Set([guardada.indice]),
      elegidas: { MR26: guardada.indice },
    });
    const suya = recalculado.candidatas.filter((c) => c.audiencia === "MR26");
    expect(suya.some((c) => c.indice === guardada.indice)).toBe(true);
    const ajenas = recalculado.candidatas.filter((c) => c.audiencia !== "MR26");
    expect(ajenas.some((c) => c.indice === guardada.indice)).toBe(false);
  });

  it("elegir una frase hoy cambia lo que se ofrece los días siguientes", () => {
    // Es el punto de todo esto: el calendario dejó de ser una preselección fija
    // del año. Se busca una frase que el corpus coloca en dos días distintos y
    // se comprueba que quemarla en el primero la borra del segundo.
    const hoy = diaDeFrases(FECHA);
    const conFuturo = hoy.candidatas.find((c) =>
      aparicionesDeFrase(c.indice).some((a) => a.fecha > FECHA),
    );
    expect(conFuturo, "el corpus no reusa ninguna candidata de este día").toBeTruthy();

    const futura = aparicionesDeFrase(conFuturo.indice).find((a) => a.fecha > FECHA);
    const antes = diaDeFrases(futura.fecha);
    expect(antes.candidatas.some((c) => c.indice === conFuturo.indice)).toBe(true);

    const despues = diaDeFrases(futura.fecha, { usadas: new Set([conFuturo.indice]) });
    expect(despues.candidatas.some((c) => c.indice === conFuturo.indice)).toBe(false);
    expect(despues.candidatas).toHaveLength(16);
  });

  it("es determinista: el mismo stock quemado da el mismo día", () => {
    const usadas = new Set(diaDeFrases(FECHA).candidatas.slice(0, 5).map((c) => c.indice));
    const a = diaDeFrases(FECHA, { usadas });
    const b = diaDeFrases(FECHA, { usadas: new Set(usadas) });
    expect(a.candidatas.map((c) => c.indice)).toEqual(b.candidatas.map((c) => c.indice));
  });

  it("las alternativas tampoco ofrecen lo quemado", () => {
    const quemadas = [...Array(50).keys()];
    const { opciones } = alternativasParaAudiencia({
      fecha: FECHA,
      audiencia: "HR26",
      excluir: quemadas,
    });
    for (const o of opciones) expect(quemadas).not.toContain(o.indice);
  });
});

describe("el corpus como stock que se consume", () => {
  it("a 8 audiencias por día, el stock rinde un octavo de lo que parece", () => {
    const stock = estadoDeStock({ usadas: 0, fecha: PRIMER_DIA });
    expect(stock.total).toBe(totalFrases());
    expect(stock.disponibles).toBe(totalFrases());
    expect(stock.diasQueAlcanza).toBe(Math.floor(totalFrases() / 8));
    // La ventana del corpus son 365 días: si el stock no da para tantos, el
    // panel tiene que decirlo en vez de dejar que se descubra a mitad de camino.
    expect(stock.diasHastaElFinal).toBe(365);
    expect(stock.suficiente).toBe(false);
    expect(stock.faltan).toBe(365 * 8 - totalFrases());
  });

  it("descuenta lo quemado y adelanta la fecha en que se agota", () => {
    const limpio = estadoDeStock({ usadas: 0, fecha: PRIMER_DIA });
    const gastado = estadoDeStock({ usadas: 400, fecha: PRIMER_DIA });
    expect(gastado.disponibles).toBe(limpio.disponibles - 400);
    expect(gastado.diasQueAlcanza).toBeLessThan(limpio.diasQueAlcanza);
    expect(gastado.alcanzaHasta < limpio.alcanzaHasta).toBe(true);
  });

  it("con menos audiencias por día el mismo stock rinde más", () => {
    const ocho = estadoDeStock({ usadas: 0, fecha: PRIMER_DIA, audiencias: 8 });
    const cuatro = estadoDeStock({ usadas: 0, fecha: PRIMER_DIA, audiencias: 4 });
    expect(cuatro.diasQueAlcanza).toBe(ocho.diasQueAlcanza * 2);
  });

  it("agotado no devuelve números negativos", () => {
    const vacio = estadoDeStock({ usadas: totalFrases() + 100, fecha: PRIMER_DIA });
    expect(vacio.disponibles).toBe(0);
    expect(vacio.diasQueAlcanza).toBe(0);
    expect(vacio.suficiente).toBe(false);
  });
});

describe("la elección guardada nunca se pierde de vista", () => {
  const FECHA = "2026-10-10";

  it("una sustitución guardada aparece en su audiencia aunque no sea del día", () => {
    // Caso real: se sustituyó por una traída del corpus y además la casilla que
    // el corpus tenía ahí ya estaba quemada. Sin este cuidado, la elección
    // guardada desaparecía de su propia lista y el radio salía sin marcar.
    const dia = diaDeFrases(FECHA);
    const delDia = new Set(dia.candidatas.map((c) => c.indice));
    const ajena = [...Array(totalFrases()).keys()].find((i) => !delDia.has(i));
    const quemada = dia.candidatas.find((c) => c.audiencia === "HRJ" && c.slot === 1);

    const recalculado = diaDeFrases(FECHA, {
      usadas: new Set([quemada.indice, ajena]),
      elegidas: { HRJ: ajena },
    });

    const suyas = recalculado.candidatas.filter((c) => c.audiencia === "HRJ");
    expect(suyas).toHaveLength(2);
    expect(suyas.some((c) => c.indice === ajena)).toBe(true);
    // Y sigue bloqueada para las otras siete.
    expect(recalculado.candidatas.filter((c) => c.indice === ajena)).toHaveLength(1);
  });
});

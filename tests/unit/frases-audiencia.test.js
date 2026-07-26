import { describe, it, expect } from "vitest";
import {
  AUDIENCIAS_REGISTRADAS,
  EDAD_CORTE,
  normalizarGenero,
  edadDe,
  hashEstable,
  audienciaDeUsuario,
  esAudienciaRegistrada,
} from "@/lib/frases-audiencia";
import { AUDIENCIAS } from "@/lib/frases";

const AHORA = new Date("2026-10-10T18:00:00Z"); // mediodía en Costa Rica

describe("normalización de género", () => {
  it("entiende el vocabulario del formulario de registro", () => {
    expect(normalizarGenero("femenino")).toBe("F");
    expect(normalizarGenero("masculino")).toBe("M");
  });

  it("entiende el vocabulario del editor de perfil", () => {
    expect(normalizarGenero("F")).toBe("F");
    expect(normalizarGenero("M")).toBe("M");
  });

  it("es indiferente a mayúsculas y espacios", () => {
    expect(normalizarGenero(" Femenino ")).toBe("F");
    expect(normalizarGenero("MASCULINO")).toBe("M");
  });

  it("devuelve null para lo que el binario del corpus no cubre", () => {
    for (const v of ["no_binario", "otro", "O", "N", "", null, undefined, "cualquier cosa"]) {
      expect(normalizarGenero(v), `${v}`).toBeNull();
    }
  });
});

describe("edad", () => {
  it("calcula la edad cumplida", () => {
    expect(edadDe("2000-01-01", AHORA)).toBe(26);
    expect(edadDe(new Date("2000-01-01T00:00:00Z"), AHORA)).toBe(26);
  });

  it("no cuenta el año si todavía no cumplió", () => {
    // El 10 de octubre de 2026, alguien nacido el 11 de octubre de 2000 tiene 25.
    expect(edadDe("2000-10-11", AHORA)).toBe(25);
    expect(edadDe("2000-10-10", AHORA)).toBe(26); // cumple hoy
    expect(edadDe("2000-10-09", AHORA)).toBe(26);
  });

  it("devuelve null cuando no hay dato utilizable", () => {
    expect(edadDe(null, AHORA)).toBeNull();
    expect(edadDe("", AHORA)).toBeNull();
    expect(edadDe("no-es-fecha", AHORA)).toBeNull();
  });

  it("descarta fechas absurdas", () => {
    expect(edadDe("2050-01-01", AHORA)).toBeNull(); // futuro
    expect(edadDe("1800-01-01", AHORA)).toBeNull(); // 226 años
  });
});

describe("audiencia de un usuario registrado", () => {
  it("mapea mujer adulta a MR26 y hombre adulto a HR26", () => {
    expect(audienciaDeUsuario({ id: "u1", gender: "femenino", birthDate: "1990-05-05" }, AHORA))
      .toMatchObject({ audiencia: "MR26", derivada: false });
    expect(audienciaDeUsuario({ id: "u2", gender: "M", birthDate: "1990-05-05" }, AHORA))
      .toMatchObject({ audiencia: "HR26", derivada: false });
  });

  it("mapea las franjas jóvenes a MRJ y HRJ", () => {
    expect(audienciaDeUsuario({ id: "u3", gender: "F", birthDate: "2008-05-05" }, AHORA))
      .toMatchObject({ audiencia: "MRJ", derivada: false });
    expect(audienciaDeUsuario({ id: "u4", gender: "masculino", birthDate: "2008-05-05" }, AHORA))
      .toMatchObject({ audiencia: "HRJ", derivada: false });
  });

  it("corta exactamente en los 26 años", () => {
    const justo26 = audienciaDeUsuario({ id: "u5", gender: "F", birthDate: "2000-10-10" }, AHORA);
    const casi26 = audienciaDeUsuario({ id: "u6", gender: "F", birthDate: "2000-10-11" }, AHORA);
    expect(justo26.audiencia).toBe("MR26");
    expect(casi26.audiencia).toBe("MRJ");
    expect(EDAD_CORTE).toBe(26);
  });

  it("nunca devuelve una audiencia de no registrados", () => {
    const casos = [
      { id: "a", gender: "femenino", birthDate: "1990-01-01" },
      { id: "b", gender: "no_binario", birthDate: "2010-01-01" },
      { id: "c", gender: null, birthDate: null },
      { id: "d", gender: "otro", birthDate: "1975-01-01" },
    ];
    for (const u of casos) {
      const { audiencia } = audienciaDeUsuario(u, AHORA);
      expect(AUDIENCIAS_REGISTRADAS, `${u.id}`).toContain(audiencia);
      expect(esAudienciaRegistrada(audiencia)).toBe(true);
    }
  });

  it("las 4 audiencias registradas existen en el corpus", () => {
    const delCorpus = new Set(AUDIENCIAS.map((a) => a.id));
    for (const id of AUDIENCIAS_REGISTRADAS) expect(delCorpus.has(id)).toBe(true);
  });

  it("las 4 audiencias registradas son, en el corpus, de gente registrada", () => {
    for (const id of AUDIENCIAS_REGISTRADAS) {
      expect(AUDIENCIAS.find((a) => a.id === id).registro).toBe(true);
    }
  });
});

describe("reparto estable para quien no cae en el binario", () => {
  const noBinarie = (id) => ({ id, gender: "no_binario", birthDate: "1990-01-01" });

  it("marca la audiencia como derivada", () => {
    expect(audienciaDeUsuario(noBinarie("x"), AHORA).derivada).toBe(true);
  });

  it("a la misma persona le toca siempre la misma audiencia", () => {
    const primera = audienciaDeUsuario(noBinarie("usuario-estable"), AHORA).audiencia;
    for (let i = 0; i < 20; i += 1) {
      expect(audienciaDeUsuario(noBinarie("usuario-estable"), AHORA).audiencia).toBe(primera);
    }
  });

  it("no depende del día: la frase cambia, la audiencia no", () => {
    const enero = audienciaDeUsuario(noBinarie("z"), new Date("2027-01-05T18:00:00Z")).audiencia;
    const julio = audienciaDeUsuario(noBinarie("z"), new Date("2027-07-05T18:00:00Z")).audiencia;
    expect(enero).toBe(julio);
  });

  it("respeta la franja etaria de la persona", () => {
    const joven = audienciaDeUsuario({ id: "j", gender: "otro", birthDate: "2010-01-01" }, AHORA);
    expect(["MRJ", "HRJ"]).toContain(joven.audiencia);
    const adulte = audienciaDeUsuario({ id: "j", gender: "otro", birthDate: "1980-01-01" }, AHORA);
    expect(["MR26", "HR26"]).toContain(adulte.audiencia);
  });

  it("reparte entre las dos opciones y no colapsa en una sola", () => {
    const vistas = new Set();
    for (let i = 0; i < 200; i += 1) {
      vistas.add(audienciaDeUsuario(noBinarie(`user-${i}`), AHORA).audiencia);
    }
    expect(vistas).toEqual(new Set(["MR26", "HR26"]));
  });

  it("el reparto es razonablemente parejo", () => {
    let m = 0;
    const N = 400;
    for (let i = 0; i < N; i += 1) {
      if (audienciaDeUsuario(noBinarie(`persona-${i}`), AHORA).audiencia === "MR26") m += 1;
    }
    // Sin exigir perfección: que ninguna se lleve más del 70 %.
    expect(m).toBeGreaterThan(N * 0.3);
    expect(m).toBeLessThan(N * 0.7);
  });

  it("explica por qué la audiencia fue derivada", () => {
    expect(audienciaDeUsuario({ id: "q", gender: null, birthDate: null }, AHORA).motivo)
      .toMatch(/sin género ni fecha/i);
    expect(audienciaDeUsuario(noBinarie("q"), AHORA).motivo).toMatch(/binario/i);
  });

  it("sin fecha de nacimiento asume la franja adulta", () => {
    const r = audienciaDeUsuario({ id: "sin-fecha", gender: "F", birthDate: null }, AHORA);
    expect(r.audiencia).toBe("MR26");
    expect(r.franja).toBe("26+");
  });
});

describe("hashEstable", () => {
  it("es determinista", () => {
    expect(hashEstable("abc")).toBe(hashEstable("abc"));
  });

  it("distingue entradas distintas", () => {
    expect(hashEstable("abc")).not.toBe(hashEstable("abd"));
  });

  it("devuelve un entero sin signo", () => {
    for (const s of ["", "a", "cksk2j3k4j", "ñandú"]) {
      const h = hashEstable(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("los usuarios reales de la base quedan todos clasificados", () => {
  // Distribución verificada en producción: masculino(3), F(1), no_binario(1),
  // otro(1), null(1). Ninguno puede quedarse sin frase.
  const reales = [
    { id: "r1", gender: "masculino", birthDate: "1985-03-12" },
    { id: "r2", gender: "masculino", birthDate: "1999-08-01" },
    { id: "r3", gender: "masculino", birthDate: "2005-02-20" },
    { id: "r4", gender: "F", birthDate: "1992-11-30" },
    { id: "r5", gender: "no_binario", birthDate: "2001-06-15" },
    { id: "r6", gender: "otro", birthDate: "1978-01-09" },
    { id: "r7", gender: null, birthDate: "1996-04-04" },
  ];

  it("los 7 reciben una audiencia registrada válida", () => {
    for (const u of reales) {
      const { audiencia } = audienciaDeUsuario(u, AHORA);
      expect(AUDIENCIAS_REGISTRADAS, u.id).toContain(audiencia);
    }
  });

  it("3 de los 7 llegan por reparto derivado", () => {
    const derivadas = reales.filter((u) => audienciaDeUsuario(u, AHORA).derivada);
    expect(derivadas.map((u) => u.id)).toEqual(["r5", "r6", "r7"]);
  });
});

// tests/unit/acuerdo.test.js
// El acuerdo de atención: cuándo hay que pedirlo, cuándo hay que repasarlo y con
// qué contexto queda registrado.
//
// Lo que se fija acá es la diferencia entre los dos candados. Confundirlos es el
// error fácil: la pausa de agenda la levanta el administrador, el repaso lo
// cierra la persona, y uno no implica el otro.
import { describe, it, expect } from "vitest";
import {
  CONTEXTOS,
  VERSION_ACUERDO,
  acuerdoDesactualizado,
  contextoDeRepaso,
  contextoPendiente,
  debeAceptarAcuerdo,
  invitacionARepasar,
  necesitaReleerAcuerdo,
} from "../../src/lib/acuerdo.js";
import { MOTIVOS_BLOQUEO } from "../../src/lib/rescheduling-policy.js";

const alDia = { acuerdoVersion: VERSION_ACUERDO, acuerdoPendienteDesde: null };

describe("necesitaReleerAcuerdo()", () => {
  it("es falso para quien está al día", () => {
    expect(necesitaReleerAcuerdo(alDia)).toBe(false);
  });

  it("es verdadero apenas se le marca el repaso", () => {
    expect(necesitaReleerAcuerdo({ ...alDia, acuerdoPendienteDesde: new Date() })).toBe(true);
  });

  it("no se cae con un usuario sin cargar", () => {
    expect(necesitaReleerAcuerdo(null)).toBe(false);
    expect(necesitaReleerAcuerdo(undefined)).toBe(false);
  });
});

describe("acuerdoDesactualizado()", () => {
  it("marca a quien nunca aceptó nada", () => {
    expect(acuerdoDesactualizado({ acuerdoVersion: null })).toBe(true);
  });

  it("marca a quien aceptó una versión vieja", () => {
    expect(acuerdoDesactualizado({ acuerdoVersion: "2020-01" })).toBe(true);
  });

  it("no marca a quien aceptó la vigente", () => {
    expect(acuerdoDesactualizado(alDia)).toBe(false);
  });
});

describe("debeAceptarAcuerdo()", () => {
  it("basta con cualquiera de las dos razones", () => {
    expect(debeAceptarAcuerdo({ acuerdoVersion: null, acuerdoPendienteDesde: null })).toBe(true);
    expect(debeAceptarAcuerdo({ ...alDia, acuerdoPendienteDesde: new Date() })).toBe(true);
    expect(debeAceptarAcuerdo(alDia)).toBe(false);
  });
});

describe("contextoDeRepaso()", () => {
  it("distingue la ausencia del aviso tardío", () => {
    expect(contextoDeRepaso(MOTIVOS_BLOQUEO.NO_ASISTIO)).toBe(CONTEXTOS.REPASO_TRAS_AUSENCIA);
    expect(contextoDeRepaso(MOTIVOS_BLOQUEO.REAGENDA_TARDIA)).toBe(CONTEXTOS.REPASO_TRAS_MULTA);
  });

  it("ante un motivo desconocido no inventa una ausencia", () => {
    expect(contextoDeRepaso("CUALQUIER_COSA")).toBe(CONTEXTOS.REPASO_TRAS_MULTA);
  });
});

describe("contextoPendiente()", () => {
  it("el repaso manda sobre la primera aceptación", () => {
    const user = {
      acuerdoVersion: null,
      acuerdoPendienteDesde: new Date(),
      acuerdoPendienteMotivo: CONTEXTOS.REPASO_TRAS_AUSENCIA,
    };
    // Aunque nunca haya aceptado, lo que importa registrar es que releyó por
    // haber faltado: si esto devolviera REGISTRO se perdería el motivo real.
    expect(contextoPendiente(user)).toBe(CONTEXTOS.REPASO_TRAS_AUSENCIA);
  });

  it("sin repaso pendiente, es el registro inicial", () => {
    expect(contextoPendiente({ acuerdoVersion: null })).toBe(CONTEXTOS.REGISTRO);
  });
});

describe("invitacionARepasar()", () => {
  it("nunca menciona el cargo ni la multa", () => {
    for (const contexto of [CONTEXTOS.REPASO_TRAS_AUSENCIA, CONTEXTOS.REPASO_TRAS_MULTA]) {
      const texto = Object.values(invitacionARepasar(contexto)).join(" ").toLowerCase();
      expect(texto).not.toMatch(/multa|cargo|cobr|50%|penaliz/);
    }
  });

  it("habla distinto según lo que pasó", () => {
    const ausencia = invitacionARepasar(CONTEXTOS.REPASO_TRAS_AUSENCIA);
    const tardia = invitacionARepasar(CONTEXTOS.REPASO_TRAS_MULTA);
    expect(ausencia.cuerpo).not.toBe(tardia.cuerpo);
  });
});

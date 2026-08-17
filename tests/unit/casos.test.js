// tests/unit/casos.test.js
// El registro administrativo de procesos: qué se exige para cerrar uno, cuánto
// se conserva y cuándo se abre uno nuevo. Prisma está mockeado.
//
// Acá no hay expediente clínico y estos tests existen en parte para que siga
// siendo así: si alguien agrega un campo de relato al cierre, `validarCierre`
// deja de tener sentido y estas pruebas tienen que doler.
//
// El borde que más importa: una baja por abandono sin ningún intento de contacto
// registrado no se puede proponer. Es la diferencia entre constatar un abandono
// y fabricarlo por omisión.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    caso: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    casoEvento: { create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

import {
  ANIOS_CONSERVACION,
  ESTADOS,
  EVENTOS,
  RESULTADOS,
  abrirCasoSiNoExiste,
  bloqueoPorCierreEnCurso,
  estadoParaPaciente,
  fechaDeConservacion,
  sePuedeDepurar,
  validarCierre,
} from "@/lib/casos";

const CIERRE_VALIDO = {
  tipoCierre: "ALTA_POR_OBJETIVOS",
  personaInformada: true,
  registradoEnExpediente: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validarCierre()", () => {
  it("acepta un alta con las dos declaraciones", () => {
    const res = validarCierre(CIERRE_VALIDO);
    expect(res.ok).toBe(true);
    expect(res.resultado).toBe(RESULTADOS.ALTA);
  });

  it("rechaza un tipo de cierre inventado", () => {
    expect(validarCierre({ ...CIERRE_VALIDO, tipoCierre: "ALTA_PORQUE_SI" }).ok).toBe(false);
  });

  it("no cierra sin haber informado a la persona", () => {
    expect(validarCierre({ ...CIERRE_VALIDO, personaInformada: false }).ok).toBe(false);
  });

  it("no cierra sin constancia de registro en el expediente del profesional", () => {
    expect(validarCierre({ ...CIERRE_VALIDO, registradoEnExpediente: false }).ok).toBe(false);
  });

  it("ignora cualquier campo de relato que le manden", () => {
    // Si alguien reintroduce texto clínico por la puerta de atrás, no se valida
    // ni se persiste: la firma de validarCierre es la lista completa.
    const conRelato = validarCierre({
      ...CIERRE_VALIDO,
      evolucion: "la persona mejoró mucho",
      estadoActual: "estable",
    });
    expect(conRelato.ok).toBe(true);
    expect(conRelato).not.toHaveProperty("evolucion");
  });

  it("una derivación sin destino no es una derivación", () => {
    const sinDestino = { ...CIERRE_VALIDO, tipoCierre: "BAJA_POR_DERIVACION" };
    expect(validarCierre(sinDestino).ok).toBe(false);
    expect(validarCierre({ ...sinDestino, derivadoA: "  " }).ok).toBe(false);

    const conDestino = validarCierre({ ...sinDestino, derivadoA: "Dra. Mora, psiquiatría" });
    expect(conDestino.ok).toBe(true);
    expect(conDestino.resultado).toBe(RESULTADOS.BAJA);
  });

  it("no deja dar de baja por abandono a quien nadie contactó", () => {
    const abandono = { ...CIERRE_VALIDO, tipoCierre: "BAJA_POR_ABANDONO" };

    expect(validarCierre({ ...abandono, contactosDeReenganche: 0 }).ok).toBe(false);
    expect(validarCierre(abandono).ok).toBe(false); // sin el dato, tampoco

    const conIntento = validarCierre({ ...abandono, contactosDeReenganche: 1 });
    expect(conIntento.ok).toBe(true);
    expect(conIntento.resultado).toBe(RESULTADOS.BAJA);
  });

  it("el abandono no exige haber informado: por definición no se pudo", () => {
    const res = validarCierre({
      tipoCierre: "BAJA_POR_ABANDONO",
      personaInformada: false,
      registradoEnExpediente: true,
      contactosDeReenganche: 2,
    });
    expect(res.ok).toBe(true);
  });
});

describe("fechaDeConservacion()", () => {
  it("son diez años desde el cierre", () => {
    const cierre = new Date("2026-08-15T10:00:00Z");
    const limite = fechaDeConservacion(cierre);
    expect(limite.getFullYear()).toBe(cierre.getFullYear() + ANIOS_CONSERVACION);
    expect(limite.getMonth()).toBe(cierre.getMonth());
    expect(limite.getDate()).toBe(cierre.getDate());
  });

  it("devuelve null ante una fecha inválida en vez de una fecha cualquiera", () => {
    expect(fechaDeConservacion("no es una fecha")).toBeNull();
  });
});

describe("sePuedeDepurar()", () => {
  const cerrado = {
    estado: ESTADOS.CERRADO,
    conservarHasta: new Date("2036-08-15T00:00:00Z"),
  };

  it("no antes del plazo", () => {
    expect(sePuedeDepurar(cerrado, new Date("2030-01-01T00:00:00Z"))).toBe(false);
  });

  it("sí después del plazo", () => {
    expect(sePuedeDepurar(cerrado, new Date("2036-08-16T00:00:00Z"))).toBe(true);
  });

  it("nunca si el caso sigue abierto, aunque tenga fecha", () => {
    expect(
      sePuedeDepurar({ ...cerrado, estado: ESTADOS.ABIERTO }, new Date("2040-01-01T00:00:00Z"))
    ).toBe(false);
  });

  it("nunca si no se fijó la fecha de conservación", () => {
    expect(
      sePuedeDepurar({ estado: ESTADOS.CERRADO, conservarHasta: null }, new Date("2040-01-01"))
    ).toBe(false);
  });
});

describe("abrirCasoSiNoExiste()", () => {
  it("no abre un segundo caso si ya hay uno en curso", async () => {
    prisma.caso.findFirst.mockResolvedValueOnce({ id: "caso_abierto" });

    const res = await abrirCasoSiNoExiste({ patientId: "p1", professionalId: "pro1" });

    expect(res).toEqual({ id: "caso_abierto" });
    expect(prisma.caso.create).not.toHaveBeenCalled();
  });

  it("abre el primero con copia congelada del nombre y la cédula", async () => {
    prisma.caso.findFirst.mockResolvedValueOnce(null); // ninguno en curso
    prisma.user.findUnique.mockResolvedValueOnce({ name: "Ana Rojas", identification: "1-1111-1111" });
    prisma.caso.findFirst.mockResolvedValueOnce(null); // ninguno cerrado previo
    prisma.caso.create.mockResolvedValueOnce({ id: "caso_nuevo" });

    await abrirCasoSiNoExiste({ patientId: "p1", professionalId: "pro1" });

    const { data } = prisma.caso.create.mock.calls[0][0];
    expect(data.pacienteNombre).toBe("Ana Rojas");
    expect(data.pacienteCedula).toBe("1-1111-1111");
    expect(data.estado).toBe(ESTADOS.ABIERTO);
    expect(data.casoAnteriorId).toBeNull();
    expect(data.eventos.create.tipo).toBe(EVENTOS.APERTURA);
    // Al abrir no se guarda motivo de consulta ni nada parecido: sería dato de
    // salud (Ley 8968, art. 3.c) en una base que no lo necesita.
    expect(data).not.toHaveProperty("motivoConsulta");
  });

  it("al retomar encadena con el caso cerrado en vez de reabrirlo", async () => {
    prisma.caso.findFirst.mockResolvedValueOnce(null);
    prisma.user.findUnique.mockResolvedValueOnce({ name: "Ana Rojas", identification: null });
    prisma.caso.findFirst.mockResolvedValueOnce({ id: "caso_viejo" });
    prisma.caso.create.mockResolvedValueOnce({ id: "caso_nuevo" });

    await abrirCasoSiNoExiste({ patientId: "p1", professionalId: "pro1" });

    const { data } = prisma.caso.create.mock.calls[0][0];
    expect(data.casoAnteriorId).toBe("caso_viejo");
    expect(data.eventos.create.tipo).toBe(EVENTOS.REAPERTURA);
  });

  it("si la base falla, devuelve null y no revienta la reserva", async () => {
    prisma.caso.findFirst.mockRejectedValueOnce(new Error("db caída"));
    await expect(abrirCasoSiNoExiste({ patientId: "p1", professionalId: "pro1" })).resolves.toBeNull();
  });
});

describe("bloqueoPorCierreEnCurso()", () => {
  it("bloquea mientras el cierre espera visado", async () => {
    prisma.caso.findFirst.mockResolvedValueOnce({ id: "caso1" });
    const res = await bloqueoPorCierreEnCurso("p1", "pro1");
    expect(res?.errorCode).toBe("CIERRE_EN_REVISION");
  });

  it("no bloquea si no hay nada en visado", async () => {
    prisma.caso.findFirst.mockResolvedValueOnce(null);
    expect(await bloqueoPorCierreEnCurso("p1", "pro1")).toBeNull();
  });

  it("ante un fallo de la base deja pasar en vez de trancar la agenda", async () => {
    prisma.caso.findFirst.mockRejectedValueOnce(new Error("db caída"));
    expect(await bloqueoPorCierreEnCurso("p1", "pro1")).toBeNull();
  });
});

describe("estadoParaPaciente()", () => {
  it("nunca le devuelve el tipo de cierre crudo", () => {
    const baja = estadoParaPaciente({
      estado: ESTADOS.CERRADO,
      resultado: RESULTADOS.BAJA,
      tipoCierre: "BAJA_POR_ABANDONO",
    });
    expect(baja.etiqueta).toBe("Cerrado");
    expect(JSON.stringify(baja)).not.toMatch(/ABANDONO/i);
  });

  it("nombra el alta como el logro que es", () => {
    const alta = estadoParaPaciente({ estado: ESTADOS.CERRADO, resultado: RESULTADOS.ALTA });
    expect(alta.etiqueta).toBe("Cerrado con alta");
    expect(alta.tono).toBe("logro");
  });

  it("un cierre esperando visado todavía se muestra en curso", () => {
    expect(estadoParaPaciente({ estado: ESTADOS.PENDIENTE_VISADO }).etiqueta).toBe("En curso");
  });
});

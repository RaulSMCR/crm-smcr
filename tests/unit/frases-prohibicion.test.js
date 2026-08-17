// tests/unit/frases-prohibicion.test.js
//
// La prohibición de repetir: una frase elegida alguna vez no se puede volver a
// elegir, ni otro día ni para otra audiencia. Prisma está mockeado.
//
// La regla se comprueba en la acción y no solo en la interfaz a propósito: el
// panel ya no ofrece lo quemado, pero un enlace viejo o dos pestañas abiertas sí
// podrían mandarlo. Si alguien mueve esta comprobación a la pantalla, estos
// tests tienen que doler.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma, getSession } = vi.hoisted(() => ({
  prisma: {
    dailyPhrasePick: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    phraseSourceCheck: { findMany: vi.fn(), upsert: vi.fn() },
  },
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/auth", () => ({ getSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { elegirFraseDelDia, otrasOpcionesParaAudiencia } from "@/actions/frases-actions";
import { diaDeFrases, fraseDeIndice } from "@/lib/frases";

const FECHA = "2026-10-10";

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ role: "ADMIN", sub: "admin-1" });
  prisma.dailyPhrasePick.findFirst.mockResolvedValue(null);
  prisma.dailyPhrasePick.findMany.mockResolvedValue([]);
  prisma.dailyPhrasePick.upsert.mockResolvedValue({});
  prisma.phraseSourceCheck.findMany.mockResolvedValue([]);
});

describe("no se puede repetir una frase", () => {
  it("rechaza la que ya se publicó otro día, y dice dónde", async () => {
    prisma.dailyPhrasePick.findFirst.mockResolvedValue({ date: "2026-09-01", audience: "HRJ" });

    const r = await elegirFraseDelDia({ fecha: FECHA, indice: 5, audiencia: "MR26", slot: 1 });

    expect(r.error).toContain("2026-09-01");
    expect(r.error).toContain("HRJ");
    expect(prisma.dailyPhrasePick.upsert).not.toHaveBeenCalled();
  });

  it("busca por texto y no por índice", async () => {
    // Regenerar el corpus mueve las posiciones; lo quemado tiene que seguir
    // quemado después, y el texto es lo único estable.
    await elegirFraseDelDia({ fecha: FECHA, indice: 5, audiencia: "MR26", slot: 1 });

    const { where } = prisma.dailyPhrasePick.findFirst.mock.calls[0][0];
    expect(where.phraseText).toBe(fraseDeIndice(5).texto);
    expect(where.status).toEqual({ not: "SKIPPED" });
  });

  it("cambiar de opinión en la misma casilla sigue valiendo", async () => {
    // La consulta excluye la propia (fecha, audiencia): elegir otra vez ahí no
    // es repetir, es corregir.
    await elegirFraseDelDia({ fecha: FECHA, indice: 5, audiencia: "MR26", slot: 1 });

    const { where } = prisma.dailyPhrasePick.findFirst.mock.calls[0][0];
    expect(where.NOT).toEqual({ date: FECHA, audience: "MR26" });
    expect(prisma.dailyPhrasePick.upsert).toHaveBeenCalledTimes(1);
  });

  it("guarda cuando la frase está libre", async () => {
    const r = await elegirFraseDelDia({ fecha: FECHA, indice: 5, audiencia: "MR26", slot: 1 });

    expect(r).toEqual({ success: true });
    const args = prisma.dailyPhrasePick.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ date_audience: { date: FECHA, audience: "MR26" } });
    expect(args.create.phraseText).toBe(fraseDeIndice(5).texto);
    expect(args.create.status).toBe("APPROVED");
  });

  it("una omisión no quema nada", async () => {
    // Los días sin publicación guardan phraseIndex -1: no consumen stock y no
    // deben aparecer nunca como frase usada.
    prisma.dailyPhrasePick.findMany.mockResolvedValue([
      { date: "2026-09-01", audience: "MR26", phraseIndex: -1, phraseText: "", status: "SKIPPED" },
    ]);

    const r = await otrasOpcionesParaAudiencia({ fecha: FECHA, audiencia: "MR26" });
    expect(r.opciones.length).toBeGreaterThan(0);
  });
});

describe("las opciones que se proponen respetan la prohibición", () => {
  it("no ofrece ninguna frase ya publicada", async () => {
    const quemadas = diaDeFrases("2026-11-05").candidatas.slice(0, 8);
    prisma.dailyPhrasePick.findMany.mockResolvedValue(
      quemadas.map((c, i) => ({
        date: "2026-11-05",
        audience: `A${i}`,
        phraseIndex: c.indice,
        phraseText: c.texto,
        status: "APPROVED",
      })),
    );

    const r = await otrasOpcionesParaAudiencia({ fecha: FECHA, audiencia: "MR26" });

    expect(r.opciones.length).toBeGreaterThan(0);
    const quemadasIdx = quemadas.map((c) => c.indice);
    for (const o of r.opciones) expect(quemadasIdx).not.toContain(o.indice);
  });

  it("tampoco ofrece lo ya descartado en esta sesión", async () => {
    const primera = await otrasOpcionesParaAudiencia({ fecha: FECHA, audiencia: "HR26" });
    const vistas = primera.opciones.map((o) => o.indice);

    const segunda = await otrasOpcionesParaAudiencia({ fecha: FECHA, audiencia: "HR26", vistas });

    for (const o of segunda.opciones) expect(vistas).not.toContain(o.indice);
  });

  it("exige sesión de admin", async () => {
    getSession.mockResolvedValue({ role: "PACIENTE", sub: "x" });
    await expect(otrasOpcionesParaAudiencia({ fecha: FECHA, audiencia: "MR26" })).rejects.toThrow(
      /ADMIN/,
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { marcarSeguroPalig, quitarSeguro } from "../../src/lib/seguro-palig.js";
import { esPalig } from "../../src/lib/palig-policy.js";

function dbCon(usuario) {
  return {
    user: {
      findUnique: vi.fn(async () => usuario),
      update: vi.fn(async ({ data }) => ({ ...usuario, ...data })),
    },
  };
}

const paciente = { id: "u1", role: "USER", isActive: true, insuranceName: null };

describe("marcarSeguroPalig", () => {
  it("deja al paciente con los mismos campos que marca su perfil, y el piloto lo reconoce", async () => {
    const db = dbCon(paciente);
    await expect(marcarSeguroPalig(db, "u1")).resolves.toEqual({ ok: true });
    const { data } = db.user.update.mock.calls[0][0];
    expect(data).toEqual({ hasInsurance: true, useInsuranceForPayment: true, insuranceName: "PALIG" });
    expect(esPalig(data.insuranceName)).toBe(true);
  });

  it("respeta un nombre que ya se reconoce como PALIG", async () => {
    const db = dbCon({ ...paciente, insuranceName: "Pan American Life" });
    await marcarSeguroPalig(db, "u1");
    expect(db.user.update.mock.calls[0][0].data.insuranceName).toBe("Pan American Life");
  });

  it("reemplaza otro seguro: quien lo marca afirma que es PALIG", async () => {
    const db = dbCon({ ...paciente, insuranceName: "INS" });
    await marcarSeguroPalig(db, "u1");
    expect(db.user.update.mock.calls[0][0].data.insuranceName).toBe("PALIG");
  });

  it("no toca a profesionales, administradores ni cuentas inactivas", async () => {
    for (const u of [{ ...paciente, role: "PROFESSIONAL" }, { ...paciente, role: "ADMIN" }, { ...paciente, isActive: false }, null]) {
      const db = dbCon(u);
      await expect(marcarSeguroPalig(db, "u1")).resolves.toMatchObject({ ok: false });
      expect(db.user.update).not.toHaveBeenCalled();
    }
  });
});

describe("quitarSeguro", () => {
  it("deshace la marca sin tocar los documentos", async () => {
    const db = dbCon({ ...paciente, insuranceName: "PALIG" });
    await expect(quitarSeguro(db, "u1")).resolves.toEqual({ ok: true });
    expect(db.user.update.mock.calls[0][0].data).toEqual({ hasInsurance: false, useInsuranceForPayment: false, insuranceName: null });
  });
});

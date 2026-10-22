import { describe, expect, it } from "vitest";
import { esPalig, fechaCostaRica, validarPagoPalig } from "@/lib/palig-policy";

const patient = { id: "u1", insuranceName: "PALIG", insuranceTemplateUrl: "insurance-templates/u1/palig.pdf", insuranceTemplateProId: "pro1" };
const cita = {
  patientId: "u1", professionalId: "pro1", professional: { slug: "raul-olmedo" },
  status: "CONFIRMED", paymentStatus: "UNPAID", date: new Date("2026-10-14T22:00:00Z"),
};
const base = { patient, professionalId: "pro1", monto: 40000, confirmado: true, ahora: new Date("2026-10-21T23:00:00Z") };

describe("piloto PALIG por comprobante", () => {
  it("identifica PALIG sin incluir otras aseguradoras", () => {
    expect(esPalig("Pan-American Life")).toBe(true);
    expect(esPalig("palig")).toBe(true);
    expect(esPalig("INS")).toBe(false);
  });

  it("acepta un pago sin sesión asociada: el eje es el comprobante", () => {
    expect(validarPagoPalig(base)).toEqual({ ok: true });
  });

  it("acepta asociar una sesión de otro día: no se ata la fecha del pago a la de la cita", () => {
    expect(validarPagoPalig({ ...base, cita })).toEqual({ ok: true });
  });

  it.each([
    [{ patient: null }, "PALIG_PACIENTE"],
    [{ patient: { ...patient, insuranceName: "INS" } }, "PALIG_ASEGURADORA"],
    [{ patient: { ...patient, insuranceTemplateProId: "otro" } }, "PALIG_PLANTILLA"],
    [{ patient: { ...patient, insuranceTemplateUrl: null } }, "PALIG_PLANTILLA"],
    [{ confirmado: false }, "PALIG_CONFIRMACION"],
    [{ monto: 0 }, "PALIG_MONTO"],
  ])("bloquea un pago incompatible con el piloto: %j", (overrides, code) => {
    expect(validarPagoPalig({ ...base, ...overrides })).toMatchObject({ ok: false, code });
  });

  it.each([
    [{ professional: { slug: "otro" } }, "PALIG_PROFESIONAL"],
    [{ patientId: "otro" }, "PALIG_CITA_AJENA"],
    [{ status: "NO_SHOW" }, "PALIG_ESTADO_CITA"],
    [{ status: "CANCELLED_BY_USER" }, "PALIG_ESTADO_CITA"],
    [{ paymentStatus: "PAID" }, "PALIG_PAGO_EXISTENTE"],
    [{ date: new Date("2026-10-28T22:00:00Z") }, "PALIG_FECHA_FUTURA"],
  ])("si se elige una sesión, tiene que poder quedar pagada: %j", (overrides, code) => {
    expect(validarPagoPalig({ ...base, cita: { ...cita, ...overrides } })).toMatchObject({ ok: false, code });
  });

  it("lee el día en Costa Rica aunque en UTC ya sea el siguiente", () => {
    expect(fechaCostaRica("2026-10-22T03:00:00Z")).toBe("2026-10-21");
  });
});

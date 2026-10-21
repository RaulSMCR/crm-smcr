import { describe, expect, it } from "vitest";
import { esPalig, fechaCostaRica, validarAtencionPalig } from "@/lib/palig-policy";

const cita = {
  professionalId: "pro1", professional: { slug: "raul-olmedo" },
  patient: { insuranceName: "PALIG", insuranceTemplateUrl: "insurance-templates/p1/palig.pdf", insuranceTemplateProId: "pro1" },
  status: "CONFIRMED", paymentStatus: "UNPAID", date: new Date("2026-10-20T16:00:00Z"),
};
const options = { monto: 30000, atencionConfirmada: true, pagoConfirmado: true, ahora: new Date("2026-10-20T18:00:00Z") };

describe("piloto PALIG", () => {
  it("identifica PALIG sin incluir otras aseguradoras", () => {
    expect(esPalig("Pan-American Life")).toBe(true);
    expect(esPalig("palig")).toBe(true);
    expect(esPalig("INS")).toBe(false);
  });
  it("permite que el operador confirme una cita aún no marcada por el paciente", () => {
    expect(validarAtencionPalig(cita, options)).toEqual({ ok: true });
  });
  it.each([
    [{ professional: { slug: "otro" } }, "PALIG_PROFESIONAL"],
    [{ status: "NO_SHOW" }, "PALIG_ESTADO_CITA"],
    [{ status: "CANCELLED_BY_USER" }, "PALIG_ESTADO_CITA"],
    [{ paymentStatus: "PAID" }, "PALIG_PAGO_EXISTENTE"],
    [{ paymentStatus: "PARTIALLY_PAID" }, "PALIG_PAGO_EXISTENTE"],
    [{ date: new Date("2026-10-21T16:00:00Z") }, "PALIG_FECHA_FUTURA"],
    [{ date: new Date("2026-10-19T16:00:00Z") }, "PALIG_FECHAS_DISTINTAS"],
    [{ patient: { ...cita.patient, insuranceTemplateProId: "otro" } }, "PALIG_PLANTILLA"],
    [{ patient: { ...cita.patient, insuranceName: "INS" } }, "PALIG_ASEGURADORA"],
  ])("bloquea datos incompatibles con el piloto: %j", (overrides, code) => {
    expect(validarAtencionPalig({ ...cita, ...overrides }, options)).toMatchObject({ ok: false, code });
  });
  it("exige confirmar pago y atención separadamente", () => {
    expect(validarAtencionPalig(cita, { ...options, pagoConfirmado: false }).code).toBe("PALIG_CONFIRMACION");
    expect(validarAtencionPalig(cita, { ...options, atencionConfirmada: false }).code).toBe("PALIG_CONFIRMACION");
  });
  it("compara fechas en Costa Rica, incluso al cambiar el día en UTC", () => {
    expect(fechaCostaRica("2026-10-21T02:00:00Z")).toBe("2026-10-20");
    expect(validarAtencionPalig(cita, { ...options, ahora: new Date("2026-10-21T02:00:00Z") }).ok).toBe(true);
  });
  it.each(["2026-10-19T18:00:00Z", "2026-10-20T19:00:00Z", "invalid"])("rechaza fechas de pago incompatibles: %s", (fechaPago) => {
    expect(validarAtencionPalig(cita, { ...options, fechaPago }).code).toBe("PALIG_FECHAS_DISTINTAS");
  });
});

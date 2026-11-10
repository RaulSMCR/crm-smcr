import { describe, expect, it } from "vitest";
import { montoPendiente, pagadoDeCita, tipoDeCobroPendiente } from "@/lib/cobro-de-cita";

const aprobado = (type, amount) => ({ type, amount, status: "APPROVED" });

describe("tipoDeCobroPendiente", () => {
  it("la primera cita se cobra en dos mitades; las siguientes, enteras", () => {
    expect(tipoDeCobroPendiente({ isFirstWithProfessional: true, paymentStatus: "UNPAID" })).toBe("DEPOSIT_50");
    expect(tipoDeCobroPendiente({ isFirstWithProfessional: true, paymentStatus: "PARTIALLY_PAID" })).toBe("BALANCE_50");
    expect(tipoDeCobroPendiente({ isFirstWithProfessional: false, paymentStatus: "UNPAID" })).toBe("FULL_100");
  });
});

describe("pagadoDeCita", () => {
  it("suma solo lo aprobado y deja afuera las multas", () => {
    expect(
      pagadoDeCita([aprobado("DEPOSIT_50", "15000.00"), { type: "BALANCE_50", amount: "15000.00", status: "LINK_SENT" }, aprobado("PENALTY_50", 15000)])
    ).toBe(15000);
  });
});

describe("montoPendiente", () => {
  it("el saldo de una primera cita con adelanto es la otra mitad", () => {
    // Katherine: ₡30.000 con ₡15.000 de adelanto.
    const cita = { pricePaid: "30000.00", isFirstWithProfessional: true, paymentStatus: "PARTIALLY_PAID" };
    expect(montoPendiente(cita, [aprobado("DEPOSIT_50", "15000.00")])).toBe(15000);
  });

  it("una cita siguiente se cobra entera", () => {
    expect(montoPendiente({ pricePaid: "40000.00", isFirstWithProfessional: false, paymentStatus: "UNPAID" })).toBe(40000);
  });

  it("si la sesión se dio, lo pagado como multa cuenta (caso 2026-11-09)", () => {
    const completada = { pricePaid: 30000, isFirstWithProfessional: false, paymentStatus: "PARTIALLY_PAID", status: "COMPLETED" };
    expect(montoPendiente(completada, [aprobado("PENALTY_50", 15000)])).toBe(15000);
    expect(montoPendiente({ ...completada, status: "NO_SHOW" }, [aprobado("PENALTY_50", 15000)])).toBe(30000);
  });

  it("nunca pide más de lo que falta", () => {
    const cita = { pricePaid: 40000, isFirstWithProfessional: false, paymentStatus: "UNPAID" };
    expect(montoPendiente(cita, [aprobado("FULL_100", 30000)])).toBe(10000);
  });
});

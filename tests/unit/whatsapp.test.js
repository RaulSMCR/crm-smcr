import { describe, expect, it } from "vitest";
import { enlaceMeetPorWhatsApp, numeroWhatsApp } from "@/lib/whatsapp";

const MEET = "https://meet.google.com/abc-defg-hij";

describe("numeroWhatsApp", () => {
  it("antepone el 506 a un número tico de 8 dígitos", () => {
    expect(numeroWhatsApp("8888-1234")).toBe("50688881234");
  });
  it("respeta un número que ya trae código de país", () => {
    expect(numeroWhatsApp("+54 9 11 5555 1234")).toBe("5491155551234");
  });
  it("sin dígitos no hay número", () => {
    expect(numeroWhatsApp("")).toBeNull();
    expect(numeroWhatsApp(null)).toBeNull();
  });
});

describe("enlaceMeetPorWhatsApp", () => {
  it("arma el chat del paciente con el saludo y el enlace de Meet", () => {
    const url = new URL(enlaceMeetPorWhatsApp({ telefono: "88881234", nombre: "Ana María Rojas", meetLink: MEET }));
    expect(url.origin + url.pathname).toBe("https://wa.me/50688881234");
    expect(url.searchParams.get("text")).toBe(`Hola Ana, este es el enlace para nuestra sesión: ${MEET}`);
  });
  it("sin teléfono o sin enlace no hay botón", () => {
    expect(enlaceMeetPorWhatsApp({ telefono: "", nombre: "Ana", meetLink: MEET })).toBeNull();
    expect(enlaceMeetPorWhatsApp({ telefono: "88881234", nombre: "Ana", meetLink: null })).toBeNull();
  });
});

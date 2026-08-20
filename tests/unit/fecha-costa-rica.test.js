import { describe, it, expect } from "vitest";
import { hoyEnCostaRica } from "@/lib/timezone";
import { estadoDeVigencia } from "@/lib/frases";
import { momentoActual, hoyEnCostaRica as hoyDesdeCalendario } from "@/lib/psychosocial-calendar";
import { calcularRacha } from "@/lib/tareas-sostenidas";

describe("el «hoy» de Costa Rica", () => {
  it("devuelve YYYY-MM-DD", () => {
    expect(hoyEnCostaRica()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("usa la zona de Costa Rica y no la del servidor", () => {
    // A las 03:00 UTC del 21 en Costa Rica (UTC-6) todavía es el 20.
    expect(hoyEnCostaRica(new Date("2026-08-21T03:00:00Z"))).toBe("2026-08-20");
    expect(hoyEnCostaRica(new Date("2026-08-21T07:00:00Z"))).toBe("2026-08-21");
  });

  it("es la misma función que reexporta psychosocial-calendar", () => {
    expect(hoyDesdeCalendario).toBe(hoyEnCostaRica);
  });
});

describe("funciones que usan el «hoy» como valor por defecto", () => {
  // Todas estas reventaban o podían reventar con ReferenceError en runtime si el
  // módulo no importaba la función. No lo detectaba nada: el build pasa, los
  // tests pasan mientras se le pase la fecha explícita, y la página responde 200
  // hasta que alguien la abre. Fue lo que dejó /panel/admin/tareas caída.
  //
  // Por eso cada una se llama acá SIN argumentos: es el único llamado que
  // ejercita el valor por defecto.

  it("estadoDeVigencia() sin argumentos", () => {
    expect(() => estadoDeVigencia()).not.toThrow();
    expect(estadoDeVigencia()).toHaveProperty("diasRestantes");
  });

  it("momentoActual() sin argumentos", () => {
    expect(() => momentoActual()).not.toThrow();
  });

  it("calcularRacha() sin fecha", () => {
    expect(() => calcularRacha([])).not.toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { asuntoFormularioReclamo, nombreFormularioReclamo } from "@/lib/insurance-mail";

// 23-nov-2026: dos correos seguidos al mismo paciente con el mismo asunto y el
// mismo adjunto. Cada uno dice ahora de qué atención y de qué factura es.
describe("correo del formulario de reclamo", () => {
  const datos = { fechaAtencion: new Date("2026-11-24T02:53:19Z"), numeroFactura: "0221" }; // 23/11 20:53 en CR

  it("el asunto lleva la fecha de atención en hora de Costa Rica y la factura", () => {
    expect(asuntoFormularioReclamo(datos)).toBe("Formulario de reclamo (atención del 23/11/2026, factura 0221) — Salud Mental Costa Rica");
  });

  it("el adjunto se distingue por fecha y factura", () => {
    expect(nombreFormularioReclamo(datos)).toBe("Formulario-reclamo-2026-11-23-factura-0221.pdf");
    expect(nombreFormularioReclamo({ ...datos, extension: "jpg" })).toMatch(/\.jpg$/);
  });

  it("sin datos queda un nombre y un asunto válidos", () => {
    expect(nombreFormularioReclamo()).toBe("Formulario-reclamo.pdf");
    expect(asuntoFormularioReclamo()).toBe("Formulario de reclamo — Salud Mental Costa Rica");
  });
});

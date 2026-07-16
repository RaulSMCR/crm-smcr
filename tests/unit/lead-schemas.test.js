import { describe, expect, it } from "vitest";
import { leadSchema, firstIssueMessage } from "../../src/lib/lead-schemas.js";

const validBase = {
  name: "María Pérez",
  email: "maria@example.com",
  message: "Quisiera saber los precios de nutrición para adultos.",
};

describe("leadSchema", () => {
  it("acepta un payload mínimo válido y aplica defaults", () => {
    const r = leadSchema.safeParse(validBase);
    expect(r.success).toBe(true);
    expect(r.data.channel).toBe("CONTACT_FORM");
    expect(r.data.email).toBe("maria@example.com");
  });

  it("acepta un payload completo con atribución", () => {
    const r = leadSchema.safeParse({
      ...validBase,
      phone: "8888-8888",
      subject: "Nutrición",
      channel: "FAQ_FORM",
      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "julio",
      utmTerm: "nutricion",
      utmContent: "feed",
      referrer: "instagram.com",
      landingPath: "/servicios?utm_source=meta",
    });
    expect(r.success).toBe(true);
    expect(r.data.utmSource).toBe("meta");
  });

  it("normaliza el email a minúsculas", () => {
    const r = leadSchema.safeParse({ ...validBase, email: "MARIA@Example.COM" });
    expect(r.success).toBe(true);
    expect(r.data.email).toBe("maria@example.com");
  });

  it("rechaza email inválido", () => {
    const r = leadSchema.safeParse({ ...validBase, email: "no-es-un-correo" });
    expect(r.success).toBe(false);
    expect(firstIssueMessage(r.error)).toMatch(/correo/i);
  });

  it("rechaza mensaje demasiado corto", () => {
    const r = leadSchema.safeParse({ ...validBase, message: "hola" });
    expect(r.success).toBe(false);
    expect(firstIssueMessage(r.error)).toMatch(/corto/i);
  });

  it("rechaza nombre demasiado corto", () => {
    const r = leadSchema.safeParse({ ...validBase, name: "A" });
    expect(r.success).toBe(false);
  });

  it("rechaza un canal inválido (ej. WHATSAPP aún no soportado en el form)", () => {
    const r = leadSchema.safeParse({ ...validBase, channel: "WHATSAPP" });
    expect(r.success).toBe(false);
  });

  it("rechaza un UTM con longitud excesiva", () => {
    const r = leadSchema.safeParse({ ...validBase, utmCampaign: "x".repeat(200) });
    expect(r.success).toBe(false);
  });
});

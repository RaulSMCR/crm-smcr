// El correo le promete un plazo al usuario y la ruta graba el token con otro:
// así nació el bug de «vence pronto» (24 h al registrarse, 1 h al reenviar, misma
// plantilla). Estos tests aseguran que ambos lados salgan de la misma constante.
import { describe, expect, it, vi } from "vitest";

const sent = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (payload) => { sent.push(payload); return { data: { id: "1" } }; } };
  },
}));

process.env.RESEND_API_KEY = "test-key";

const {
  RESET_TOKEN_TTL_HOURS,
  sendResetPasswordEmail,
  sendVerificationEmail,
  ttlToDate,
  VERIFY_RESEND_TTL_HOURS,
  VERIFY_TOKEN_TTL_HOURS,
} = await import("@/lib/mail");

const lastHtml = () => sent[sent.length - 1].html;

describe("ttlToDate", () => {
  it("convierte horas en una fecha futura", () => {
    const before = Date.now();
    const result = ttlToDate(1).getTime();
    expect(result - before).toBeGreaterThanOrEqual(60 * 60 * 1000 - 50);
    expect(result - before).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
  });

  it("coincide con la vigencia que anuncian los correos", () => {
    expect(VERIFY_TOKEN_TTL_HOURS).toBe(24);
    expect(VERIFY_RESEND_TTL_HOURS).toBe(1);
    expect(RESET_TOKEN_TTL_HOURS).toBe(1);
  });
});

describe("correo de verificación", () => {
  it("anuncia 24 horas al registrarse (valor por defecto)", async () => {
    await sendVerificationEmail("ana@ejemplo.cr", "tok");
    expect(lastHtml()).toContain("El enlace vence en 24 horas");
  });

  it("anuncia 1 hora al reenviarlo, en singular", async () => {
    await sendVerificationEmail("ana@ejemplo.cr", "tok", VERIFY_RESEND_TTL_HOURS);
    const html = lastHtml();
    expect(html).toContain("El enlace vence en 1 hora;");
    expect(html).not.toContain("1 horas");
  });

  it("incluye el token en el enlace de confirmación", async () => {
    await sendVerificationEmail("ana@ejemplo.cr", "abc123");
    expect(lastHtml()).toContain("/verificar-email?token=abc123");
  });
});

describe("correo de restablecimiento", () => {
  it("anuncia la vigencia real del token de reset", async () => {
    await sendResetPasswordEmail("ana@ejemplo.cr", "tok");
    expect(lastHtml()).toContain("El enlace vence en 1 hora.");
  });

  it("incluye el token en el enlace de cambio", async () => {
    await sendResetPasswordEmail("ana@ejemplo.cr", "xyz789");
    expect(lastHtml()).toContain("/cambiar-password?token=xyz789");
  });
});

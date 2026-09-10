import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("carga facturación sin credenciales de correo y no intenta enviar una factura", async () => {
  vi.resetModules();
  vi.stubEnv("RESEND_API_KEY", undefined);
  const fetch = vi.fn(() => { throw new Error("No se permite red en esta prueba"); });
  vi.stubGlobal("fetch", fetch);

  // Usa el SDK real: un constructor de Resend sin clave rompía el build.
  const { sendFeEmail } = await import("@/lib/fe/submit.js");
  await sendFeEmail({ contact: { email: "patient@example.invalid" } });
  expect(fetch).not.toHaveBeenCalled();
});

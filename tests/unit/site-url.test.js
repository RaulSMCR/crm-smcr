// Convivían cuatro variables de entorno para la URL base más el dominio escrito
// a mano en metadatos y JSON-LD. Hoy todas valen lo mismo, así que nada falla:
// el riesgo aparece con un staging o un cambio de dominio.
import { afterEach, describe, expect, it, vi } from "vitest";

const URL_ENVS = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_BASE_URL"];

async function loadWith(env) {
  vi.resetModules();
  for (const name of URL_ENVS) vi.stubEnv(name, "");
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
  return import("@/lib/site-url");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("SITE_URL", () => {
  it("prefiere NEXT_PUBLIC_SITE_URL sobre las demás", async () => {
    const { SITE_URL } = await loadWith({
      NEXT_PUBLIC_SITE_URL: "https://uno.cr",
      NEXT_PUBLIC_URL: "https://dos.cr",
      NEXT_PUBLIC_APP_URL: "https://tres.cr",
    });
    expect(SITE_URL).toBe("https://uno.cr");
  });

  // Acepta las cuatro por compatibilidad: los despliegues existentes no tienen que tocar el entorno.
  it("acepta cualquiera de las cuatro variables heredadas", async () => {
    expect((await loadWith({ NEXT_PUBLIC_URL: "https://dos.cr" })).SITE_URL).toBe("https://dos.cr");
    expect((await loadWith({ NEXT_PUBLIC_APP_URL: "https://tres.cr" })).SITE_URL).toBe("https://tres.cr");
    expect((await loadWith({ NEXT_PUBLIC_BASE_URL: "https://cuatro.cr" })).SITE_URL).toBe("https://cuatro.cr");
  });

  it("quita la barra final para no generar URLs con doble barra", async () => {
    expect((await loadWith({ NEXT_PUBLIC_SITE_URL: "https://uno.cr/" })).SITE_URL).toBe("https://uno.cr");
    expect((await loadWith({ NEXT_PUBLIC_SITE_URL: "https://uno.cr///" })).SITE_URL).toBe("https://uno.cr");
  });

  it("ignora una variable vacía o con espacios", async () => {
    const { SITE_URL } = await loadWith({ NEXT_PUBLIC_SITE_URL: "   ", NEXT_PUBLIC_URL: "https://dos.cr" });
    expect(SITE_URL).toBe("https://dos.cr");
  });

  it("cae en el dominio de producción sin entorno", async () => {
    const { SITE_URL } = await loadWith({});
    expect(SITE_URL).toBe("https://saludmentalcostarica.com");
  });
});

describe("siteUrl", () => {
  it("une la base con la ruta sin duplicar barras", async () => {
    const { siteUrl } = await loadWith({ NEXT_PUBLIC_SITE_URL: "https://uno.cr" });
    expect(siteUrl("blog")).toBe("https://uno.cr/blog");
    expect(siteUrl("/blog")).toBe("https://uno.cr/blog");
    expect(siteUrl("blog/mi-post")).toBe("https://uno.cr/blog/mi-post");
  });

  it("devuelve la base pelada sin ruta", async () => {
    const { siteUrl, SITE_URL } = await loadWith({ NEXT_PUBLIC_SITE_URL: "https://uno.cr" });
    expect(siteUrl()).toBe(SITE_URL);
    expect(siteUrl("")).toBe(SITE_URL);
  });
});

// Que la marca no se duplique y que los listados no salgan sin imagen social.
//
// Los dos defectos que cubre este archivo eran invisibles desde el código: solo
// se veían al pegar un enlace en WhatsApp. Acá se ven al correr los tests.
import { describe, expect, it } from "vitest";
import { buildMetadata } from "../../src/lib/seo.js";

describe("og:title — la marca aparece una sola vez", () => {
  it("no repite el nombre del sitio cuando el título ya lo trae", () => {
    const meta = buildMetadata({
      title: "Salud Mental Costa Rica — Bienestar con profesionales validados",
      description: "Plataforma de salud mental en Costa Rica.",
      path: "",
    });

    expect(meta.openGraph.title).toBe(
      "Salud Mental Costa Rica — Bienestar con profesionales validados",
    );
    // Una sola aparición, no dos.
    expect(meta.openGraph.title.match(/Salud Mental Costa Rica/g)).toHaveLength(1);
  });

  it("sí la agrega cuando el título no la trae", () => {
    const meta = buildMetadata({ title: "Preguntas Frecuentes", description: "…", path: "faq" });
    expect(meta.openGraph.title).toBe("Preguntas Frecuentes | Salud Mental Costa Rica");
  });

  it("reconoce la marca aunque cambie mayúsculas o acentos", () => {
    const meta = buildMetadata({ title: "salud mental costa rica hoy", description: "…" });
    expect(meta.openGraph.title.match(/[Ss]alud [Mm]ental/g)).toHaveLength(1);
  });

  it("usa el nombre del sitio cuando no hay título", () => {
    expect(buildMetadata({ description: "…" }).openGraph.title).toBe("Salud Mental Costa Rica");
  });
});

describe("Open Graph — los listados no pueden salir sin imagen", () => {
  it.each(["servicios", "profesionales", "blog", "faq"])(
    "/%s declara imagen, siteName y type",
    (path) => {
      const meta = buildMetadata({ title: `Página de ${path}`, description: "Descripción.", path });

      expect(meta.openGraph.images?.[0]?.url).toBeTruthy();
      expect(meta.openGraph.images[0].width).toBe(1200);
      expect(meta.openGraph.images[0].height).toBe(630);
      expect(meta.openGraph.siteName).toBe("Salud Mental Costa Rica");
      expect(meta.openGraph.type).toBe("website");
      expect(meta.alternates.canonical).toContain(path);
      expect(meta.twitter.card).toBe("summary_large_image");
    },
  );
});

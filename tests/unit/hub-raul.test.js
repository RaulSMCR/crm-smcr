import { describe, expect, it } from "vitest";
import { HUB_PROFILE_SLUG, RAUL_PERSON_ID, buildWaLink, formatHubPrice, getPublishedHubTopics, readHubTheme, seoDeModulo } from "../../src/lib/hub-raul.js";
import { idPersona } from "../../src/lib/jsonld.js";
import { countUniquePatientIds, groupHubAppointments, isHubRaulAttributed } from "../../src/lib/hub-raul-dashboard.js";

describe("hub de Raúl Olmedo Evans", () => {
  // El hub declaraba `#persona` y la ficha `#person`: para Google eran dos
  // personas distintas con el mismo nombre, y ninguna heredaba las credenciales
  // ni los artículos de la otra. El `@id` es la identidad del nodo, así que la
  // igualdad se prueba, no se confía.
  it("describe a la misma persona que su ficha profesional", () => {
    expect(RAUL_PERSON_ID).toBe(idPersona(HUB_PROFILE_SLUG));
    expect(RAUL_PERSON_ID).toMatch(/\/profesionales\/raul-olmedo#person$/);
  });

  it("publica solo los temas habilitados en el JSON", () => {
    expect(getPublishedHubTopics().map((topic) => topic.slug)).toEqual([
      "ataque-de-panico",
      "duelo",
      "estres-laboral-y-burnout",
      "conflictos-de-pareja",
      "migracion-y-desarraigo",
    ]);
  });

  it("construye WhatsApp con el precio de la tarifa aprobada, duración y origen", () => {
    const url = buildWaLink("duelo", undefined, { min: 30000, max: 30000 });
    const text = decodeURIComponent(new URL(url).searchParams.get("text"));
    expect(url).toContain("https://wa.me/50671291909");
    expect(text).toContain("50 min");
    expect(text).toContain("₡30.000");
    expect(text).toContain("duelo");
  });

  it("no anuncia un precio que no salga de una tarifa vigente", () => {
    // El JSON del hub tenía un ₡40.000 fijo que ningún cambio de tarifa movía.
    const text = decodeURIComponent(new URL(buildWaLink("duelo")).searchParams.get("text"));
    expect(text).not.toContain("₡");
    expect(formatHubPrice(null)).toBe("");
    expect(formatHubPrice({ min: 30000, max: 40000 })).toBe("₡30.000 – ₡40.000");
  });

  it("lee el front matter y el contenido de un tema", () => {
    const theme = readHubTheme("duelo");
    expect(theme.titulo).toBe("Duelo");
    expect(theme.busqueda_objetivo).toContain("duelo");
    expect(theme.body).toContain("Cuándo consultar");
  });

  it("atribuye conversiones del hub sin exponer datos personales", () => {
    expect(isHubRaulAttributed({ landingPath: "/raul-olmedo-evans?utm_source=instagram" })).toBe(true);
    expect(isHubRaulAttributed({ utmCampaign: "lanzamiento-hub-raul" })).toBe(true);
    expect(isHubRaulAttributed({ landingPath: "/blog/otro-tema", utmCampaign: "otra-campana" })).toBe(false);
    const appointments = [{ patientId: "a", topicSlug: "duelo" }, { patientId: "a", topicSlug: "duelo" }, { patientId: "b", topicSlug: null }];
    expect(countUniquePatientIds(appointments)).toBe(2);
    expect(groupHubAppointments(appointments)).toEqual([{ name: "duelo", count: 2 }, { name: "Sin tema especificado", count: 1 }]);
  });
});

describe("SEO de los módulos del hub", () => {
  // El título SEO y la meta vivían dentro de la columna `metadata` (JSON) y
  // pasaron a columnas propias. La migración copia lo viejo, pero un módulo
  // guardado antes del despliegue puede llegar con el dato solo en el JSON: las
  // dos procedencias tienen que seguir leyéndose, y la columna tiene que ganar.
  it("prefiere la columna sobre lo que quedó en el JSON", () => {
    const seo = seoDeModulo({
      metaTitle: "Ataque de pánico: qué es y cuándo consultar",
      metaDescription: "Desde la columna.",
      metadata: { titulo_seo: "Título viejo", meta: "Descripción vieja" },
    });
    expect(seo.titulo_seo).toBe("Ataque de pánico: qué es y cuándo consultar");
    expect(seo.meta).toBe("Desde la columna.");
  });

  it("cae al JSON cuando la columna está vacía", () => {
    const seo = seoDeModulo({ metadata: { titulo_seo: "Título viejo", meta: "Descripción vieja" } });
    expect(seo.titulo_seo).toBe("Título viejo");
    expect(seo.meta).toBe("Descripción vieja");
  });

  it("no inventa nada cuando no hay ni columna ni JSON", () => {
    expect(seoDeModulo({})).toEqual({ titulo_seo: "", meta: "", ogImage: "", focusKeyword: "", noindex: false });
    expect(seoDeModulo(null).noindex).toBe(false);
  });

  it("expone noindex como booleano y no como lo que venga", () => {
    expect(seoDeModulo({ noindex: true }).noindex).toBe(true);
    expect(seoDeModulo({ noindex: "false" }).noindex).toBe(false);
  });
});

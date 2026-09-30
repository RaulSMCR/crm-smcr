import { describe, expect, it } from "vitest";
import { HUB_PROFILE_SLUG, RAUL_PERSON_ID, buildWaLink, esquemaTemaHub, formatHubPrice, getHubData, getPublishedHubTopics, readHubTheme, seoDeModulo } from "../../src/lib/hub-raul.js";
import { ID_ORGANIZACION, idPersona } from "../../src/lib/jsonld.js";
import { siteUrl } from "../../src/lib/site-url.js";
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

  it("nombra el tema de donde sale el clic y dice que la sesión es paga", () => {
    const url = buildWaLink("Duelo");
    const text = decodeURIComponent(new URL(url).searchParams.get("text"));
    expect(url).toContain("https://wa.me/50671291909");
    expect(text).toContain("sesión paga");
    expect(text).toContain("Vengo de la página de Duelo.");
  });

  it("sin tema, el mensaje es el de la portada del hub", () => {
    const text = decodeURIComponent(new URL(buildWaLink()).searchParams.get("text"));
    expect(text).toBe("Hola, quisiera agendar una sesión paga con Raúl Olmedo. Vengo de la página de Raúl Olmedo.");
  });

  // El mensaje se sella en HTML que se sirve cacheado una hora (`revalidate`),
  // así que un precio ahí dentro anuncia el del tramo anterior. La regla es que
  // el texto no dependa de nada que cambie entre visitas.
  it("no lleva precio ni duración en el mensaje", () => {
    const text = decodeURIComponent(new URL(buildWaLink("Duelo")).searchParams.get("text"));
    expect(text).not.toContain("₡");
    expect(text).not.toContain("min");
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

describe("JSON-LD de un tema del hub", () => {
  // Lo que validator.schema.org marcaba en producción el 29-sep-2026 sobre
  // /raul-olmedo-evans/terapia-para-la-ansiedad: `isPartOf` hacia un @id que
  // nadie declara y `reviewedBy` en un Article, que no lo admite.
  const doc = {
    titulo: "Terapia para la ansiedad",
    meta: "Qué se nombra con esa palabra y cómo se trabaja.",
    resumen: "Resumen.",
    fecha: "2026-09-14",
    actualizado: "2026-09-20",
  };
  const esquema = esquemaTemaHub({ hub: getHubData(), doc, slug: "terapia-para-la-ansiedad", imagen: "https://ejemplo.test/og.png" });
  const nodo = (tipo) => esquema["@graph"].find((item) => item["@type"] === tipo);
  const idHub = `${siteUrl("raul-olmedo-evans")}#hub`;

  it("la página es parte de la portada del hub, y ese nodo existe en el grafo", () => {
    expect(nodo("WebPage").isPartOf).toEqual({ "@id": idHub });
    expect(nodo("CollectionPage")["@id"]).toBe(idHub);
  });

  it("reviewedBy va en la página, no en el artículo", () => {
    expect(nodo("Article").reviewedBy).toBeUndefined();
    expect(nodo("WebPage").reviewedBy).toEqual({ "@id": RAUL_PERSON_ID });
    expect(nodo("WebPage").lastReviewed).toBe("2026-09-20");
  });

  it("el artículo trae imagen, fechas, autor y editor", () => {
    const articulo = nodo("Article");
    expect(articulo.image).toBe("https://ejemplo.test/og.png");
    expect(articulo.datePublished).toBe("2026-09-14T00:00:00.000Z");
    expect(articulo.dateModified).toBe("2026-09-20T00:00:00.000Z");
    expect(articulo.author).toEqual({ "@id": RAUL_PERSON_ID });
    expect(articulo.publisher).toEqual({ "@id": ID_ORGANIZACION });
  });

  it("la persona va completa: cargo y colegiatura, no solo el nombre", () => {
    const persona = nodo("Person");
    expect(persona["@id"]).toBe(RAUL_PERSON_ID);
    expect(persona.jobTitle).toBe("Psicólogo clínico y psicoanalista");
    expect(persona.hasCredential.identifier.value).toBe("8270");
  });

  it("una fecha vacía no rompe el render: se omite", () => {
    const sinFecha = esquemaTemaHub({ hub: getHubData(), doc: { ...doc, fecha: "", actualizado: "" }, slug: "x" });
    const articulo = sinFecha["@graph"].find((item) => item["@type"] === "Article");
    expect(articulo.datePublished).toBeUndefined();
    expect(articulo.image).toBeUndefined();
  });
});

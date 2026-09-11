import { describe, expect, it } from "vitest";
import { buildWaLink, formatHubPrice, getPublishedHubTopics, readHubTheme } from "../../src/lib/hub-raul.js";
import { countUniquePatientIds, groupHubAppointments, isHubRaulAttributed } from "../../src/lib/hub-raul-dashboard.js";

describe("hub de Raúl Olmedo Evans", () => {
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

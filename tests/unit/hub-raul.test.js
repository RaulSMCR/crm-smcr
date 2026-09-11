import { describe, expect, it } from "vitest";
import { buildWaLink, getPublishedHubTopics, readHubTheme } from "../../src/lib/hub-raul.js";
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

  it("construye WhatsApp con precio, duración y origen", () => {
    const url = buildWaLink("duelo");
    const text = decodeURIComponent(new URL(url).searchParams.get("text"));
    expect(url).toContain("https://wa.me/50671291909");
    expect(text).toContain("50 min");
    expect(text).toContain("₡40.000");
    expect(text).toContain("duelo");
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

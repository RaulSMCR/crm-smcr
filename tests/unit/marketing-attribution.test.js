import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  captureMarketingAttribution,
  getMarketingAttributionRaw,
} from "../../src/lib/marketing-attribution-client.js";

const STORAGE_KEY = "smcr-marketing-attribution";

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

let storage;

/** Simula que el visitante está en una URL concreta. */
function visit(search, pathname = "/") {
  window.location.search = search;
  window.location.pathname = pathname;
}

beforeEach(() => {
  storage = makeStorage();
  vi.stubGlobal("window", {
    localStorage: storage,
    location: { search: "", pathname: "/", hostname: "saludmentalcostarica.com" },
  });
  vi.stubGlobal("document", { referrer: "" });
});

afterEach(() => vi.unstubAllGlobals());

describe("captura de UTMs first-touch", () => {
  it("captura los UTMs de la URL de aterrizaje", () => {
    visit("?utm_source=meta&utm_campaign=test&utm_medium=paid_social");
    captureMarketingAttribution();
    const raw = getMarketingAttributionRaw();
    expect(raw.utmSource).toBe("meta");
    expect(raw.utmCampaign).toBe("test");
    expect(raw.utmMedium).toBe("paid_social");
    expect(raw.landingPath).toContain("utm_source=meta");
  });

  it("NO sobrescribe si ya hay atribución (first-touch)", () => {
    visit("?utm_source=meta&utm_campaign=test");
    captureMarketingAttribution();
    // Segunda llegada con otra campaña
    visit("?utm_source=google&utm_campaign=otra");
    captureMarketingAttribution();
    const raw = getMarketingAttributionRaw();
    expect(raw.utmSource).toBe("meta"); // se conserva el PRIMER toque
    expect(raw.utmCampaign).toBe("test");
  });

  it("criterio de aceptación: navegar a otra página sin UTMs conserva el primer toque", () => {
    visit("?utm_source=meta&utm_campaign=test");
    captureMarketingAttribution();
    visit("", "/nosotros"); // navega a una página sin UTMs
    const raw = getMarketingAttributionRaw();
    expect(raw.utmSource).toBe("meta");
  });

  it("guarda el referrer externo junto con los UTMs", () => {
    document.referrer = "https://l.instagram.com/ad";
    visit("?utm_source=meta");
    captureMarketingAttribution();
    expect(getMarketingAttributionRaw().referrer).toContain("instagram.com");
  });

  it("visitante orgánico (sin UTMs ni referrer): todos los campos vacíos", () => {
    visit("", "/");
    const raw = getMarketingAttributionRaw();
    expect(raw.utmSource).toBe("");
    expect(raw.utmCampaign).toBe("");
    expect(raw.referrer).toBe("");
  });

  it("captura el referrer externo cuando no hay UTMs", () => {
    document.referrer = "https://www.google.com/search";
    visit("", "/blog/algo");
    captureMarketingAttribution();
    const raw = getMarketingAttributionRaw();
    expect(raw.utmSource).toBe("");
    expect(raw.referrer).toBe("google.com"); // sin www
  });

  it("re-captura pasados 30 días (expiración de la ventana de atribución)", () => {
    const old = {
      utm_source: "old",
      capturedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(old));
    visit("?utm_source=new&utm_campaign=fresca");
    captureMarketingAttribution();
    expect(getMarketingAttributionRaw().utmSource).toBe("new");
  });
});

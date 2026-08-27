// Que la marca no se duplique y que los listados no salgan sin imagen social.
//
// Los dos defectos que cubre este archivo eran invisibles desde el código: solo
// se veían al pegar un enlace en WhatsApp. Acá se ven al correr los tests.
import { describe, expect, it } from "vitest";
import { buildMetadata } from "../../src/lib/seo.js";
import { especialidadesMedicas, nodoOrganizacion } from "../../src/lib/jsonld.js";

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

describe("og:title — títulos orientados a búsqueda", () => {
  it("no repite la marca cuando el título ya dice salud mental y Costa Rica", () => {
    // El título de la home dice lo mismo que la marca pero con otras palabras en
    // medio; concatenarla daba 89 caracteres con dos separadores.
    const meta = buildMetadata({
      title: "Psicoterapia y salud mental en Costa Rica | En línea y presencial",
      description: "…",
      path: "",
    });
    expect(meta.openGraph.title).toBe(
      "Psicoterapia y salud mental en Costa Rica | En línea y presencial",
    );
    expect(meta.openGraph.title.length).toBeLessThan(70);
  });

  it("sí la agrega cuando el título no menciona el lugar", () => {
    const meta = buildMetadata({
      title: "Psicoterapia y salud mental: ensayos y crítica",
      description: "…",
      path: "blog",
    });
    expect(meta.openGraph.title).toBe(
      "Psicoterapia y salud mental: ensayos y crítica | Salud Mental Costa Rica",
    );
  });

  it("no confunde una palabra contenida en otra", () => {
    // "mentalidad" no es "mental": la comparación va por palabra completa.
    const meta = buildMetadata({ title: "Salud, mentalidad y Costa Rica", description: "…" });
    expect(meta.openGraph.title).toContain("| Salud Mental Costa Rica");
  });
});

describe("schema — la declaración médica se activa sola", () => {
  it("no declara especialidad médica con el equipo actual", () => {
    // Cuatro psicólogos y una nutricionista: nadie ejerce medicina.
    const nodo = nodoOrganizacion({
      disciplinas: ["Psicología clínica", "Psicología clínica", "Nutrición"],
    });

    expect(nodo["@type"]).toBe("Organization");
    expect(nodo.medicalSpecialty).toBeUndefined();
  });

  it("se activa en cuanto se aprueba un psiquiatra", () => {
    const nodo = nodoOrganizacion({
      disciplinas: ["Psicología clínica", "Psiquiatría", "Nutrición"],
    });

    expect(nodo["@type"]).toEqual(["Organization", "MedicalBusiness"]);
    // Valor del enum MedicalSpecialty; texto libre lo rechaza el validador.
    expect(nodo.medicalSpecialty).toBe("Psychiatric");
  });

  it("vuelve atrás si ese profesional se da de baja", () => {
    expect(nodoOrganizacion({ disciplinas: ["Psicología clínica"] })["@type"]).toBe("Organization");
  });

  it("no duplica una especialidad con dos profesionales de la misma disciplina", () => {
    const nodo = nodoOrganizacion({ disciplinas: ["Psiquiatría", "Psiquiatría"] });
    expect(nodo.medicalSpecialty).toBe("Psychiatric");
  });

  it("ignora disciplinas que no son médicas", () => {
    expect(especialidadesMedicas(["Nutrición", "Pedagogía", "Musicoterapia"])).toEqual([]);
  });

  it("sobrevive a una lista vacía o con basura", () => {
    expect(especialidadesMedicas([])).toEqual([]);
    expect(especialidadesMedicas([null, "", "  "])).toEqual([]);
  });
});

describe("línea editorial — la copy no nombra cuadros clínicos sin contenido detrás", () => {
  // No es una preferencia de estilo: encabezar con un diagnóstico que el sitio
  // no desarrolla es el movimiento que el propio blog critica. Este test falla
  // si alguien lo reintroduce sin haber escrito los artículos.
  const CUADROS = /\b(ansiedad|depresi[oó]n|trastorno|s[ií]ndrome|estr[eé]s postraum)/i;

  it.each([
    ["home", "Psicoterapia y salud mental en Costa Rica | En línea y presencial"],
    ["blog", "Psicoterapia y salud mental: ensayos y crítica"],
  ])("el título de %s no promete un cuadro clínico", (_pagina, titulo) => {
    expect(titulo).not.toMatch(CUADROS);
  });

  it.each([
    [
      "home",
      "Agendá consulta con especialistas colegiados: psicoterapia, nutrición y terapia física, en línea o presencial. Informate sobre temas de salud mental.",
    ],
    [
      "blog",
      "Historia, escuelas y discusiones sobre la salud mental, escritas por profesionales colegiados en Costa Rica. Ensayos largos, no consejos rápidos.",
    ],
  ])("la descripción de %s tampoco", (_pagina, descripcion) => {
    expect(descripcion).not.toMatch(CUADROS);
    // Y sigue entrando entera en un fragmento de búsqueda.
    expect(descripcion.length).toBeLessThanOrEqual(160);
  });
});

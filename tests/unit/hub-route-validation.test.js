import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { verificarRutas } from "@/lib/hub-ingest";

const modulos = ["tratamiento-breve-15-sesiones", "terapia-para-la-ansiedad", "ataque-de-panico", "duelo", "conflictos-de-pareja", "estres-laboral-y-burnout"];
const hubPublicado = (extra = {}) => ({ slug: "raul-olmedo-evans", status: "PUBLISHED", isActive: true, modules: modulos.map((slug) => ({ slug, isPublished: true, isVisible: true })), ...extra });

function contexto(hubs = []) {
  const db = { professionalHub: { findMany: vi.fn(async () => hubs) } };
  return { hubSlug: "psicoanalisis", slugsDelHub: new Set(), db };
}

describe("enlaces entre hubs", () => {
  it("comprueba en una sola consulta los seis enlaces desde el hub de contenido al de Raúl", async () => {
    const opciones = contexto([hubPublicado()]);
    const rutas = modulos.map((slug) => `/raul-olmedo-evans/${slug}`);
    const estados = await verificarRutas(rutas, opciones);
    expect([...estados.values()]).toEqual(rutas.map(() => "ok"));
    expect(opciones.db.professionalHub.findMany).toHaveBeenCalledTimes(1);
    expect(opciones.db.professionalHub.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: { in: ["raul-olmedo-evans"] } } }));
  });
  it("reconoce la ruta histórica que redirige al hub de Raúl", async () => {
    const estados = await verificarRutas(["/raul-olmedo/duelo?origen=hub#consulta"], contexto([hubPublicado()]));
    expect(estados.get("/raul-olmedo/duelo?origen=hub#consulta")).toBe("ok");
  });
  it.each([{ status: "DRAFT" }, { isActive: false }])("bloquea destinos en un hub que no es público: %s", async (extra) => {
    const estados = await verificarRutas(["/raul-olmedo-evans/duelo"], contexto([hubPublicado(extra)]));
    expect(estados.get("/raul-olmedo-evans/duelo")).toBe("el hub de destino no existe publicado");
  });
  it.each([{ modules: [] }, { modules: [{ slug: "duelo", isPublished: false, isVisible: true }] }, { modules: [{ slug: "duelo", isPublished: true, isVisible: false }] }])("bloquea módulos ausentes, borradores u ocultos: %s", async ({ modules }) => {
    const estados = await verificarRutas(["/raul-olmedo-evans/duelo"], contexto([hubPublicado({ modules })]));
    expect(estados.get("/raul-olmedo-evans/duelo")).toBe("el módulo de destino no existe publicado y visible");
  });
  it("mantiene la validación de piezas del propio feed sin exigir que ya estén publicadas", async () => {
    const opciones = { ...contexto(), hubSlug: "raul-olmedo-evans", slugsDelHub: new Set(["duelo"]) };
    const estados = await verificarRutas(["/raul-olmedo-evans/duelo"], opciones);
    expect(estados.get("/raul-olmedo-evans/duelo")).toBe("ok");
    expect(opciones.db.professionalHub.findMany).not.toHaveBeenCalled();
  });
  it("no da por pública una URL hija cuyo hub carece de plantilla", async () => {
    const estados = await verificarRutas(["/otro-hub/duelo"], contexto([hubPublicado({ slug: "otro-hub" })]));
    expect(estados.get("/otro-hub/duelo")).toBe("no verificable");
  });
});

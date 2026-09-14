// tests/unit/hub-serie-destacada.test.js
// El hub publicado enlazaba `/blog/serie/${hub.serie_destacada}` sin comprobar
// que esa serie existiera, con el nombre escrito a mano en el JSX. El slug
// destacado era `la-angustia-y-sus-formas`, que no corresponde a ninguna serie
// cargada, así que la página del hub ofrecía un enlace a un 404. Lo que se
// prueba acá es la condición que decide si el enlace se emite.
//
// Va en su propio archivo porque `hub-raul.test.js` importa el módulo sin
// mockear prisma —sus funciones no lo tocan— y no vale la pena cargarle un
// mock que no necesita.
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { series: { findFirst: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));

const { getFeaturedSeries } = await import("../../src/lib/hub-raul.js");

describe("serie destacada del hub", () => {
  beforeEach(() => {
    prisma.series.findFirst.mockReset();
  });

  it("devuelve la serie cuando existe, para que el rótulo salga de la base", async () => {
    prisma.series.findFirst.mockResolvedValue({ slug: "la-angustia-y-sus-formas", name: "La angustia y sus formas" });
    await expect(getFeaturedSeries("la-angustia-y-sus-formas")).resolves.toEqual({
      slug: "la-angustia-y-sus-formas",
      name: "La angustia y sus formas",
    });
  });

  it("exige `isActive` y al menos una entrega publicada y aprobada", async () => {
    prisma.series.findFirst.mockResolvedValue(null);
    await getFeaturedSeries("la-angustia-y-sus-formas");
    const { where } = prisma.series.findFirst.mock.calls[0][0];
    expect(where).toEqual({
      slug: "la-angustia-y-sus-formas",
      isActive: true,
      posts: { some: { status: "PUBLISHED", seriesApproved: true } },
    });
  });

  it("no enlaza una serie que no existe: ese era el 404", async () => {
    prisma.series.findFirst.mockResolvedValue(null);
    await expect(getFeaturedSeries("la-angustia-y-sus-formas")).resolves.toBeNull();
  });

  it("no consulta cuando el destacado está vacío", async () => {
    await expect(getFeaturedSeries("")).resolves.toBeNull();
    await expect(getFeaturedSeries(null)).resolves.toBeNull();
    await expect(getFeaturedSeries(undefined)).resolves.toBeNull();
    expect(prisma.series.findFirst).not.toHaveBeenCalled();
  });

  it("si la base falla, la sección queda sin enlace en vez de romper el hub", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    prisma.series.findFirst.mockRejectedValue(new Error("sin conexión"));
    await expect(getFeaturedSeries("la-angustia-y-sus-formas")).resolves.toBeNull();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

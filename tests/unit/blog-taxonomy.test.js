import { describe, expect, it } from "vitest";
import {
  LIBRARY_SORTS,
  buildLibraryOrderBy,
  libraryHref,
  parseLibraryParams,
} from "../../src/lib/blog-taxonomy.js";

describe("orden de la biblioteca del blog", () => {
  it("ofrece ordenar por series", () => {
    expect(LIBRARY_SORTS.series).toBe("Por series");
    expect(parseLibraryParams({ orden: "series" }).sort).toBe("series");
  });

  it("agrupa las series y ordena sus partes antes de los artículos sueltos", () => {
    expect(buildLibraryOrderBy({ sort: "series" })).toEqual([
      { seriesApproved: "desc" },
      { series: { name: "asc" } },
      { seriesOrder: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ]);
  });

  it("conserva filtros al activar el orden por series", () => {
    expect(libraryHref({ q: "salud", autor: null, disciplina: null, tema: null, serie: null, sort: "recientes" }, { sort: "series" })).toBe(
      "/blog?q=salud&orden=series",
    );
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// El helper importa el cliente real de Prisma; acá se reemplaza por uno de
// mentira para poder probar la lógica de cadenas y la degradación sin base.
const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { slugRedirect: { findUnique: (...a) => findUnique(...a), upsert: (...a) => upsert(...a) } },
}));

const { resolveRedirect, registrarRedirect, TIPOS } = await import("@/lib/slug-redirect");

describe("resolveRedirect", () => {
  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("devuelve null si no hay redirect registrado", async () => {
    findUnique.mockResolvedValue(null);
    expect(await resolveRedirect(TIPOS.POST, "articulo-que-existe")).toBe(null);
  });

  it("devuelve el slug vigente en un salto", async () => {
    findUnique.mockResolvedValueOnce({ toSlug: "raul-olmedo" }).mockResolvedValueOnce(null);
    expect(await resolveRedirect(TIPOS.PROFESIONAL, "ral-olmedo")).toBe("raul-olmedo");
  });

  it("sigue la cadena cuando un slug migró dos veces", async () => {
    // Es el caso que decidió D2 a favor de la tabla: la URL más vieja publicada
    // tiene que llegar al destino final, no al intermedio.
    findUnique
      .mockResolvedValueOnce({ toSlug: "paso-intermedio" })
      .mockResolvedValueOnce({ toSlug: "destino-final" })
      .mockResolvedValueOnce(null);
    expect(await resolveRedirect(TIPOS.POST, "slug-original")).toBe("destino-final");
  });

  it("devuelve null ante un ciclo en vez de colgarse", async () => {
    findUnique
      .mockResolvedValueOnce({ toSlug: "b" })
      .mockResolvedValueOnce({ toSlug: "a" });
    expect(await resolveRedirect(TIPOS.POST, "a")).toBe(null);
  });

  it("degrada a null si la consulta falla, sin lanzar", async () => {
    // Es lo que permite desplegar el código antes de crear la tabla. Si el error
    // se propagara, todo 404 del sitio se volvería un 500, porque acá se llega
    // justamente cuando la entidad no se encontró.
    findUnique.mockRejectedValue(new Error("relation \"SlugRedirect\" does not exist"));
    await expect(resolveRedirect(TIPOS.POST, "lo-que-sea")).resolves.toBe(null);
  });

  it("ignora tipos de entidad desconocidos y slugs vacíos", async () => {
    expect(await resolveRedirect("inventado", "x")).toBe(null);
    expect(await resolveRedirect(TIPOS.POST, "")).toBe(null);
    expect(await resolveRedirect(TIPOS.POST, "   ")).toBe(null);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("normaliza mayúsculas y espacios del slug entrante", async () => {
    findUnique.mockResolvedValueOnce({ toSlug: "destino" }).mockResolvedValueOnce(null);
    expect(await resolveRedirect(TIPOS.POST, "  Slug-VIEJO  ")).toBe("destino");
    expect(findUnique.mock.calls[0][0].where.entityType_fromSlug.fromSlug).toBe("slug-viejo");
  });
});

describe("registrarRedirect", () => {
  beforeEach(() => {
    upsert.mockReset();
    upsert.mockResolvedValue({});
  });

  it("rechaza un redirect que apunta a sí mismo", async () => {
    await expect(registrarRedirect(TIPOS.POST, "mismo", "mismo")).rejects.toThrow(/sí mismo/);
  });

  it("rechaza origen o destino vacíos", async () => {
    await expect(registrarRedirect(TIPOS.POST, "", "destino")).rejects.toThrow();
    await expect(registrarRedirect(TIPOS.POST, "origen", "")).rejects.toThrow();
  });

  it("rechaza un tipo de entidad desconocido", async () => {
    await expect(registrarRedirect("inventado", "a", "b")).rejects.toThrow(/desconocido/);
  });

  it("usa upsert para que correr la migración dos veces sea inofensivo", async () => {
    await registrarRedirect(TIPOS.POST, "Viejo", "Nuevo");
    const arg = upsert.mock.calls[0][0];
    expect(arg.create).toEqual({ entityType: "post", fromSlug: "viejo", toSlug: "nuevo" });
    expect(arg.update).toEqual({ toSlug: "nuevo" });
  });

  it("acepta un cliente de transacción", async () => {
    const tx = { slugRedirect: { upsert: vi.fn().mockResolvedValue({}) } };
    await registrarRedirect(TIPOS.POST, "a", "b", tx);
    expect(tx.slugRedirect.upsert).toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});

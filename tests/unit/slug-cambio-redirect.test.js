import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { registrarCambioDeSlug, TIPOS } from "@/lib/slug-redirect";

function clienteFalso() {
  return { slugRedirect: { deleteMany: vi.fn(async () => ({ count: 0 })), upsert: vi.fn(async (a) => a) } };
}

describe("cambio de slug de un artículo", () => {
  it("la URL vieja redirige a la nueva", async () => {
    const tx = clienteFalso();
    await registrarCambioDeSlug(TIPOS.POST, "parte-i-viejo", "capitulo-2", tx);
    expect(tx.slugRedirect.upsert).toHaveBeenCalledWith({
      where: { entityType_fromSlug: { entityType: "post", fromSlug: "parte-i-viejo" } },
      update: { toSlug: "capitulo-2" },
      create: { entityType: "post", fromSlug: "parte-i-viejo", toSlug: "capitulo-2" },
    });
  });

  it("volver a un nombre anterior borra su redirect, para no armar un ciclo", async () => {
    const tx = clienteFalso();
    await registrarCambioDeSlug(TIPOS.POST, "capitulo-2", "parte-i-viejo", tx);
    expect(tx.slugRedirect.deleteMany).toHaveBeenCalledWith({ where: { entityType: "post", fromSlug: "parte-i-viejo" } });
  });

  it("sin cambio real no escribe nada", async () => {
    const tx = clienteFalso();
    await expect(registrarCambioDeSlug(TIPOS.POST, "mismo", "Mismo", tx)).resolves.toBeNull();
    expect(tx.slugRedirect.upsert).not.toHaveBeenCalled();
  });
});

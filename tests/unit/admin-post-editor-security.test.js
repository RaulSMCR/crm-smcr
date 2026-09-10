import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { getAdminPostForEditor } from "../../src/lib/admin-post-editor.js";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { post: { findUnique } } }));

// Simula la proyección de Prisma, no su conexión a la base de datos.
function project(row, select) {
  if (row == null) return row;
  return Object.fromEntries(Object.entries(select).map(([key, rule]) => [
    key, rule === true ? row[key] : project(row[key], rule.select),
  ]));
}

describe("Datos del editor administrativo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("excluye credenciales y datos privados aunque existan en el registro del autor", async () => {
    const record = {
      id: "post_test", title: "Artículo", content: "Contenido", status: "DRAFT",
      author: {
        googleRefreshToken: "private-google-marker", iban: "private-bank-marker",
        cvUrl: "private-document-marker",
        user: { name: "Autora", passwordHash: "private-password-marker", resetTokenHash: "private-reset-marker", email: "private-contact-marker" },
      },
      futurePrivateField: "private-future-marker",
    };
    findUnique.mockImplementation(({ select }) => Promise.resolve(project(record, select)));
    const post = await getAdminPostForEditor(record.id);
    expect(post.title).toBe(record.title);
    expect(post.content).toBe(record.content);
    expect(post.status).toBe("DRAFT");
    expect(post.author.user.name).toBe("Autora");
    expect(JSON.stringify(post)).not.toContain("private-");
    expect(findUnique.mock.calls[0][0].where).toEqual({ id: record.id });
  });

  it("selecciona todos los campos que consume el editor y solo campos reales del schema", async () => {
    findUnique.mockResolvedValue(null);
    await getAdminPostForEditor("missing");
    const { select } = findUnique.mock.calls[0][0];
    const source = readFileSync(new URL("../../src/components/admin/AdminPostEditor.js", import.meta.url), "utf8");
    for (const [, field] of source.matchAll(/\bpost\.([A-Za-z][A-Za-z0-9_]*)/g)) {
      expect(select, `Campo consumido por el editor: ${field}`).toHaveProperty(field);
    }
    const schemaFields = Prisma.dmmf.datamodel.models.find((model) => model.name === "Post").fields.map((field) => field.name);
    expect(Object.keys(select).every((field) => schemaFields.includes(field))).toBe(true);
  });

  it("conserva el resultado nulo que la página utiliza para responder 404", async () => {
    findUnique.mockResolvedValue(null);
    expect(await getAdminPostForEditor("missing")).toBeNull();
  });
});

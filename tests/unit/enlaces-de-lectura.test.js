import { beforeEach, describe, expect, it, vi } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: { topic: { findFirst: vi.fn() }, post: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/hub-raul", () => ({ HUB_PATH: "raul-olmedo-evans" }));

import { enlacesDeLectura } from "@/lib/enlaces-de-lectura";

const GUIA = { slug: "que-es-psicoterapia-y-como-orientarse-entre-escuelas", title: "Qué es psicoterapia y cómo orientarse entre escuelas" };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.topic.findFirst.mockResolvedValue({ slug: "ansiedad" });
  prisma.post.findFirst.mockResolvedValue(GUIA);
});

describe("enlaces de lectura (S17)", () => {
  it("ofrece el tema, la guía y el hub", async () => {
    const enlaces = await enlacesDeLectura();
    expect(enlaces.map((e) => e.href)).toEqual(["/ansiedad", `/blog/${GUIA.slug}`, "/raul-olmedo-evans"]);
  });

  it("no enlaza lo que no está publicado", async () => {
    prisma.topic.findFirst.mockResolvedValue(null);
    prisma.post.findFirst.mockResolvedValue(null);
    expect((await enlacesDeLectura()).map((e) => e.href)).toEqual(["/raul-olmedo-evans"]);
    expect(prisma.topic.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "PUBLISHED" }),
    }));
  });

  it("un artículo no se ofrece a sí mismo", async () => {
    const enlaces = await enlacesDeLectura({ excluirPostSlug: GUIA.slug });
    expect(enlaces.map((e) => e.clave)).toEqual(["tema", "hub"]);
  });
});

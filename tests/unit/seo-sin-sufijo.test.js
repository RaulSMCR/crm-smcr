import { describe, expect, it } from "vitest";
import { buildMetadata } from "@/lib/seo";

describe("título sin sufijo (páginas del hub)", () => {
  it("con sinSufijo el título es absoluto: el layout no le agrega la marca", () => {
    const m = buildMetadata({ title: "Terapia para la ansiedad con psicólogo en línea", path: "raul-olmedo-evans/x", sinSufijo: true });
    expect(m.title).toEqual({ absolute: "Terapia para la ansiedad con psicólogo en línea" });
  });

  it("por defecto el título lleva la marca del layout", () => {
    expect(buildMetadata({ title: "Blog", path: "blog" }).title).toBe("Blog");
  });
});

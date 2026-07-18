import { describe, expect, it } from "vitest";
import { normalizeImageSrc } from "@/lib/images";

describe("normalizeImageSrc", () => {
  it("keeps safe absolute and local image URLs", () => {
    expect(normalizeImageSrc("https://example.com/photo.jpg?x=1")).toBe("https://example.com/photo.jpg?x=1");
    expect(normalizeImageSrc("/images/profesional-hero.webp")).toBe("/images/profesional-hero.webp");
    expect(normalizeImageSrc("images/paciente-hero.webp")).toBe("/images/paciente-hero.webp");
  });

  it("rejects unsafe protocols and non-image data URLs", () => {
    expect(normalizeImageSrc("javascript:alert(1)")).toBe("");
    expect(normalizeImageSrc("data:text/html;base64,PGgxPkJvb208L2gxPg==")).toBe("");
  });

  it("converts known public storage references to Supabase URLs", () => {
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";

    expect(normalizeImageSrc("avatars/user-1/avatar.jpg?v=123")).toBe(
      "https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.jpg?v=123",
    );

    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  });
});

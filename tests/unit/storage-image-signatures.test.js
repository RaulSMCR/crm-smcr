import { describe, expect, it } from "vitest";
import { detectFileMimeType, validatePublicImageUpload } from "@/lib/storage";

describe("image upload signatures", () => {
  it("detects supported browser image formats by signature", () => {
    expect(detectFileMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xdb]))).toBe("image/jpeg");
    expect(detectFileMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectFileMimeType(Buffer.from("GIF89a", "ascii"))).toBe("image/gif");
    expect(detectFileMimeType(Buffer.from("RIFFxxxxWEBP", "ascii"))).toBe("image/webp");
    expect(detectFileMimeType(Buffer.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]))).toBe("image/avif");
  });

  it("validates public image uploads with content type consistency", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    expect(validatePublicImageUpload(png, "image/png")).toMatchObject({
      ok: true,
      contentType: "image/png",
      extension: "png",
    });
    expect(validatePublicImageUpload(Buffer.from([0xff, 0xd8, 0xff, 0xdb]), "image/jpg")).toMatchObject({
      ok: true,
      contentType: "image/jpeg",
      extension: "jpg",
    });
    expect(validatePublicImageUpload(png, "image/jpeg")).toMatchObject({ ok: false });
    expect(validatePublicImageUpload(Buffer.from("<svg></svg>"), "image/svg+xml")).toMatchObject({ ok: false });
  });
});

import { describe, expect, it } from "vitest";
import {
  applyImportToSlides,
  compareSlides,
  normalizeCurrentSlides,
  normalizeImportedPackage,
} from "@/lib/editorial-import";

describe("editorial import", () => {
  it("validates the versioned package envelope", () => {
    const result = normalizeImportedPackage({
      format: "smcr-editorial-package",
      schemaVersion: 1,
      mode: "full",
      carousel: { title: "Carrusel", slides: [] },
    });
    expect(result.ok).toBe(true);
  });

  it("reports text and asset changes by stable slide id", () => {
    const current = [{ slideId: "slide-01", position: 1, type: "cover", title: "Antes", assetRefs: [] }];
    const incoming = [{ slideId: "slide-01", position: 1, type: "cover", title: "Después", assetRefs: [{ path: "assets/new.png" }] }];
    expect(compareSlides(current, incoming)).toEqual([
      expect.objectContaining({ slideId: "slide-01", kind: "modified", textChanged: true, assetChanged: true }),
    ]);
  });

  it("applies partial replacement without changing other slides", () => {
    const current = [
      { slideId: "slide-01", position: 1, type: "cover", title: "Uno" },
      { slideId: "slide-02", position: 2, type: "content", title: "Dos" },
    ];
    const result = applyImportToSlides(current, {
      mode: "partial",
      changes: [{
        slideId: "slide-02",
        operation: "replace",
        slide: { slideId: "slide-02", position: 2, type: "content", title: "Dos revisado" },
      }],
    });
    expect(result[0].title).toBe("Uno");
    expect(result[1].title).toBe("Dos revisado");
  });

  it("assigns stable ids to legacy slides from their assets", () => {
    const result = normalizeCurrentSlides(
      { slides: [{ type: "cover", title: "Portada" }] },
      [{ id: "asset-1", index: 0, filename: "slide.png" }]
    );
    expect(result[0].slideId).toBe("slide-asset-1");
  });
});

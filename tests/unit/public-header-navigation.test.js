import { describe, expect, it } from "vitest";
import { getPatientHeaderLinks } from "@/lib/public-header-navigation";

function labelsFor(pathname) {
  return getPatientHeaderLinks(pathname).map((link) => link.label);
}

describe("patient header navigation", () => {
  it("shows services and blog from the patient profile", () => {
    expect(labelsFor("/panel/paciente")).toEqual(["Servicios", "Blog"]);
  });

  it("excludes blog while reading the blog", () => {
    expect(labelsFor("/blog/como-cuidarse")).toEqual(["Mi perfil", "Servicios"]);
  });

  it("excludes services while browsing a service", () => {
    expect(labelsFor("/servicios/consulta-inicial")).toEqual(["Blog", "Mi perfil"]);
  });

  it("offers all patient destinations on unrelated pages", () => {
    expect(labelsFor("/faq")).toEqual(["Mi perfil", "Servicios", "Blog"]);
  });
});

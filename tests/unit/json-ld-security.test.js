import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import JsonLd from "../../src/components/JsonLd.js";

describe("JsonLd: frontera entre datos y HTML", () => {
  it.each([
    '</script><script>alert("test")</script>',
    '</ScRiPt><img src=x onerror="test()">',
    "<!--<script>dato</script>-->",
  ])("mantiene el contenido editable dentro de un único script JSON: %s", (name) => {
    const data = { "@context": "https://schema.org", "@type": "Person", name };
    const markup = renderToStaticMarkup(createElement(JsonLd, { data }));
    expect(markup.match(/<script\b/gi)).toHaveLength(1);
    expect(markup.match(/<\/script>/gi)).toHaveLength(1);
    const json = markup.slice(markup.indexOf(">") + 1, markup.lastIndexOf("</script>"));
    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toEqual(data);
  });

  it("conserva acentos, relaciones, números y contenido clínico como datos", () => {
    const data = { name: "Psicología y nutrición", description: "A < B & C", author: { name: "Profesional" }, count: 2 };
    const markup = renderToStaticMarkup(createElement(JsonLd, { data }));
    expect(JSON.parse(markup.replace(/^<script[^>]*>|<\/script>$/g, ""))).toEqual(data);
  });
});

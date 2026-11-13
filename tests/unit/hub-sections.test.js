import { describe, expect, it } from "vitest";
import { seccionesHub, variablesHub } from "@/lib/hub-sections";
import { remarkBloquesHub } from "@/lib/hub-sections";
import { quitarComentariosHtml } from "@/lib/markdown-comentarios";
import { encabezadosConAncla } from "@/lib/markdown-encabezados";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function htmlHub(md) {
  return renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm, remarkBloquesHub], components: encabezadosConAncla() }, quitarComentariosHtml(md, { conservarBloques: true })));
}

describe("cajas del hub", () => {
  it("delimita cada caja hasta el siguiente h2 y conserva h3, listas y enlaces", () => {
    const secciones = seccionesHub("## Introducción\n\nTexto.\n\n<!-- bloque: cuando-consultar -->\n## Consulta\n\n- Motivo\n\n### Detalle\n\nTexto.\n\n## Otra sección\n\nFuera.\n\n<!-- bloque: riesgo -->\n## Riesgo\n\n[Ayuda](/ayuda-inmediata)\n\n<!-- bloque: aviso -->\n\n## Aviso\n\nNota.");
    expect(secciones.map((s) => s.bloque)).toEqual([null, "cuando-consultar", null, "riesgo", "aviso"]);
    expect(secciones[1].markdown).toContain("### Detalle");
    expect(secciones[1].markdown).not.toContain("Fuera");
    expect(secciones[3].markdown).toContain("[Ayuda]");
    expect(secciones[3].markdown).not.toContain("Aviso");
  });
  it("ignora marcadores y encabezados dentro de código", () => {
    expect(seccionesHub("```md\n<!-- bloque: riesgo -->\n## Riesgo\n```\n\nTexto.").map((s) => s.bloque)).toEqual([null]);
  });
  it("conserva las piezas históricas sin marcadores", () => {
    expect(seccionesHub("## Una sección\n\nTexto.\n\n## Otra sección")).toEqual([{ bloque: null, markdown: "## Una sección\n\nTexto.\n\n## Otra sección" }]);
  });
  it("resuelve variables con datos actuales sin modificar el documento original", () => {
    const md = "{{precio_sesion}} · {{duracion_sesion}} min · {{whatsapp}}";
    expect(variablesHub(md, { precio: "₡30.000", duracion: 50, whatsapp: "50600000000" })).toBe("₡30.000 · 50 min · 50600000000");
    expect(md).toContain("{{precio_sesion}}");
  });
  it("renderiza cajas reales con sus anclas, referencias globales y sin comentarios o botones", () => {
    const html = htmlHub("<!-- nota interna -->\n\n<!-- bloque: cuando-consultar -->\n## Cuándo consultar\n\n- Motivo.\n\n<!-- bloque: riesgo -->\n## Riesgo\n\n[Ayuda][recurso]\n\n<!-- bloque: aviso -->\n## Aviso\n\nNota.\n\n## Fuera\n\nTexto.\n\n[recurso]: /ayuda-inmediata");
    expect(html).toContain('data-bloque="cuando-consultar"');
    expect(html).toContain('id="cuando-consultar"');
    expect(html).toContain('data-bloque="riesgo"');
    expect(html).toContain('data-bloque="aviso"');
    expect(html.match(/<section/g)).toHaveLength(3);
    expect(html).toContain('href="/ayuda-inmediata"');
    expect(html).toContain('</section>\n<h2 id="fuera">');
    expect(html).not.toContain("nota interna");
    expect(html).not.toContain("&lt;!--");
    expect(html).not.toContain("<button");
  });
  it("un marcador suelto o dentro de código no crea una caja", () => {
    expect(htmlHub("<!-- bloque: riesgo -->\n\nProsa.")).not.toContain("<section");
    expect(htmlHub("```md\n<!-- bloque: riesgo -->\n## Ejemplo\n```")).not.toContain("<section");
  });
});

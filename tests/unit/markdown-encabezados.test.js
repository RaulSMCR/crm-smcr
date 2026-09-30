import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { encabezadosConAncla, textoPlano } from "@/lib/markdown-encabezados";
import { leerEncabezados } from "@/lib/hub-markdown";
import { quitarComentariosHtml } from "@/lib/markdown-comentarios";

/**
 * El índice lateral de un tema del hub enlaza `#id`, y el `id` lo pone el
 * renderer. Las dos puntas se prueban juntas: un índice que apunta a anclas que
 * el HTML no tiene no falla en ningún lado, simplemente no lleva a ninguna parte.
 *
 * Mismo setup que markdown-comentarios-render.test.js: los plugins del
 * renderer, sin JSX.
 */
function aHtml(cuerpo, components = {}) {
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components }, quitarComentariosHtml(cuerpo)),
  );
}

// Los encabezados de la pieza de ansiedad publicada, con sus marcadores.
const CUERPO = [
  "## Qué se nombra cuando se dice ansiedad",
  "",
  "Prosa con *énfasis*.",
  "",
  "## Por qué todo se llama ansiedad",
  "",
  "<!-- bloque: cuando-consultar -->",
  "## Cuándo conviene consultar",
  "",
  "- Algo que antes hacías sin pensarlo se volvió difícil.",
  "",
  "<!-- bloque: riesgo -->",
  "## Si estás en una situación de riesgo",
  "",
  "### Un subtítulo con *énfasis*",
].join("\n");

describe("anclas en los encabezados", () => {
  it("cada entrada del índice apunta a un id que el HTML tiene", () => {
    const html = aHtml(CUERPO, encabezadosConAncla());
    const indice = leerEncabezados(CUERPO);
    expect(indice).toHaveLength(5);
    for (const { id } of indice) expect(html).toContain(`id="${id}"`);
  });

  it("el id sale del texto que se lee, sin las marcas de énfasis", () => {
    const html = aHtml("### Un subtítulo con *énfasis*", encabezadosConAncla());
    expect(html).toContain('<h3 id="un-subtitulo-con-enfasis">');
  });

  it("sin la opción, el HTML no cambia: los artículos del blog no llevan ids", () => {
    const html = aHtml(CUERPO);
    expect(html).not.toContain("id=");
    expect(html).toContain("<h2>Qué se nombra cuando se dice ansiedad</h2>");
  });

  it("lee el texto de nodos anidados", () => {
    const nodo = {
      type: "element",
      children: [{ type: "text", value: "Sobre " }, { type: "element", children: [{ type: "text", value: "la serie" }] }],
    };
    expect(textoPlano(nodo)).toBe("Sobre la serie");
    expect(textoPlano(null)).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { quitarComentariosHtml } from "@/lib/markdown-comentarios";

/**
 * La prueba que faltaba: el pipeline de render, no solo el filtro.
 *
 * El bug no estaba en el parser ni en la ingesta —el cuerpo se guardaba bien—,
 * estaba en que `react-markdown` **escapa** el HTML crudo cuando corre sin
 * `rehype-raw`, y un comentario escapado es texto visible. Un test del filtro
 * solo no lo habría encontrado: hacía falta mirar el HTML que sale.
 *
 * Se reproducen acá los mismos plugins que `src/components/MarkdownRenderer.js`
 * (menos `rehypeHighlight`, que solo pinta código y no cambia esto) porque el
 * componente es JSX y el setup de esta suite no transforma JSX en archivos `.js`.
 * Si algún día se le agrega `rehype-raw` al renderer, el primer test de acá
 * seguirá pasando y el segundo es el que avisa que el escapado cambió.
 */

function aHtml(cuerpo) {
  return renderToStaticMarkup(createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, cuerpo));
}

const CUERPO = "## Qué ocurre\n\nTexto.\n\n<!-- bloque: riesgo -->\n\nSi hay riesgo, llamá.\n";

describe("marcadores de bloque en el HTML publicado", () => {
  it("filtrado, el marcador no llega al HTML", () => {
    const html = aHtml(quitarComentariosHtml(CUERPO));
    expect(html).not.toContain("bloque");
    expect(html).not.toContain("--");
    expect(html).toContain("<h2>Qué ocurre</h2>");
    expect(html).toContain("Si hay riesgo, llamá.");
  });

  it("sin filtrar, el comentario sale escapado: esto es lo que se veía publicado", () => {
    const html = aHtml(CUERPO);
    expect(html).toContain("&lt;!-- bloque: riesgo --&gt;");
  });
});

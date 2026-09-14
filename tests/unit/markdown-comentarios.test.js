import { describe, it, expect } from "vitest";
import { quitarComentariosHtml } from "@/lib/markdown-comentarios";
import { leerBloques } from "@/lib/hub-markdown";

/**
 * El filtro de comentarios HTML antes de renderizar.
 *
 * Lo que se prueba es lo que se vio publicado: un `<!-- bloque: riesgo -->` en el
 * cuerpo de un tema salía como texto literal en la página, porque el renderer
 * corre sin `rehype-raw` y en esa configuración `react-markdown` escapa el
 * comentario en vez de ignorarlo.
 */

describe("quitarComentariosHtml", () => {
  it("quita el marcador de bloque que se veía en la página", () => {
    const cuerpo = "## Qué ocurre\n\nTexto.\n\n<!-- bloque: riesgo -->\n\nSi hay riesgo, llamá.\n";
    const salida = quitarComentariosHtml(cuerpo);
    expect(salida).not.toContain("bloque");
    expect(salida).not.toContain("<!--");
    expect(salida).toContain("## Qué ocurre");
    expect(salida).toContain("Si hay riesgo, llamá.");
  });

  it("quita cualquier comentario, no solo los de bloque", () => {
    expect(quitarComentariosHtml("Hola.\n\n<!-- revisar esto -->\n\nChau.")).not.toContain("revisar");
  });

  it("quita un comentario de varias líneas", () => {
    const cuerpo = "Antes.\n\n<!--\n  nota larga\n  en dos renglones\n-->\n\nDespués.";
    const salida = quitarComentariosHtml(cuerpo);
    expect(salida).not.toContain("nota larga");
    expect(salida).toContain("Antes.");
    expect(salida).toContain("Después.");
  });

  it("quita varios en el mismo cuerpo", () => {
    const cuerpo = "<!-- bloque: cuando-consultar -->\nUno.\n<!-- bloque: riesgo -->\nDos.";
    expect(quitarComentariosHtml(cuerpo)).not.toContain("<!--");
  });

  it("es un no-op exacto cuando no hay comentarios", () => {
    const cuerpo = "## Título\n\n\n\nTexto con    espacios y\n\n\nsaltos de sobra.\n";
    expect(quitarComentariosHtml(cuerpo)).toBe(cuerpo);
  });

  it("no toca un comentario dentro de un bloque de código", () => {
    const cuerpo = "Así se escribe:\n\n```html\n<!-- bloque: riesgo -->\n```\n\nY listo.";
    const salida = quitarComentariosHtml(cuerpo);
    expect(salida).toContain("<!-- bloque: riesgo -->");
    expect(salida).toContain("Y listo.");
  });

  it("no toca un comentario en código en línea", () => {
    const cuerpo = "El marcador es `<!-- bloque: riesgo -->`, y va solo en su línea.";
    expect(quitarComentariosHtml(cuerpo)).toBe(cuerpo);
  });

  it("limpia la prosa aunque el cuerpo tenga además un bloque de código", () => {
    const cuerpo = "<!-- bloque: riesgo -->\n\nTexto.\n\n```js\nconst a = 1;\n```\n\n<!-- nota -->\n\nFin.";
    const salida = quitarComentariosHtml(cuerpo);
    expect(salida).not.toContain("<!--");
    expect(salida).toContain("const a = 1;");
  });

  it("aguanta un cercado sin cerrar sin comerse el resto", () => {
    const cuerpo = "```\nsin cerrar\n<!-- adentro -->";
    expect(quitarComentariosHtml(cuerpo)).toContain("<!-- adentro -->");
  });

  it("aguanta vacío y nulo", () => {
    expect(quitarComentariosHtml("")).toBe("");
    expect(quitarComentariosHtml(null)).toBe("");
    expect(quitarComentariosHtml(undefined)).toBe("");
  });
});

describe("el filtro no le saca información a la ingesta", () => {
  it("el cuerpo guardado conserva los marcadores, que es de donde los lee el informe", () => {
    const cuerpo = "## Qué ocurre\n\nTexto.\n\n<!-- bloque: riesgo -->\n\nSi hay riesgo, llamá.";
    // Lo que se filtra es la salida al público; `leerBloques` sigue leyendo el
    // cuerpo tal como se guardó. Si algún día se filtrara al importar, esto
    // devolvería una lista vacía y el informe dejaría de avisar bloques faltantes.
    expect(leerBloques(cuerpo)).toEqual(["riesgo"]);
    expect(leerBloques(quitarComentariosHtml(cuerpo))).toEqual([]);
  });
});

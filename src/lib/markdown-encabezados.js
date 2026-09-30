import { createElement } from "react";
import { normalizeTopicSlug } from "@/lib/topic";

/** Texto de un nodo hast tal como se lee en la página, sin marcas. */
export function textoPlano(nodo) {
  if (!nodo) return "";
  if (nodo.type === "text") return nodo.value || "";
  return (nodo.children || []).map(textoPlano).join("");
}

/**
 * Componentes de `react-markdown` que les ponen `id` a los `##` y `###`.
 *
 * El `id` sale de la misma función que usa `leerEncabezados`
 * (`src/lib/hub-markdown.js`) para armar el índice lateral de las páginas de
 * tema del hub, así que cada entrada del índice apunta a un ancla que existe.
 *
 * Es opcional —`<MarkdownRenderer idsEnEncabezados />`— porque en los
 * artículos del blog nadie enlaza todavía a sus secciones, y no hay por qué
 * cambiarle el HTML a todo el sitio para servir a una plantilla.
 *
 * Vive fuera del componente, y sin JSX, para poder probarlo: la suite no
 * transforma JSX en archivos `.js`.
 */
export function encabezadosConAncla() {
  const conAncla = (etiqueta) =>
    function EncabezadoConAncla({ node, children, ...props }) {
      const id = normalizeTopicSlug(textoPlano(node));
      return createElement(etiqueta, id ? { ...props, id } : props, children);
    };
  return { h2: conAncla("h2"), h3: conAncla("h3") };
}

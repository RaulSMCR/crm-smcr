import { createElement } from "react";

export default function JsonLd({ data }) {
  // El contenido sigue siendo JSON, pero no puede cerrar el elemento script.
  const json = JSON.stringify(data)?.replace(/</g, "\\u003c");
  return createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: json },
  });
}

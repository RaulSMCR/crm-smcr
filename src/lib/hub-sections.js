/** Separa cajas sin ejecutar HTML ni interpretar marcadores dentro de código. */
export function seccionesHub(markdown) {
  const lineas = String(markdown || "").split("\n");
  const secciones = [];
  let actual = { bloque: null, lineas: [] };
  let cerca = null;
  for (let i = 0; i < lineas.length; i += 1) {
    const linea = lineas[i];
    const fence = linea.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (!cerca) cerca = fence[1];
      else if (fence[1][0] === cerca[0] && fence[1].length >= cerca.length) cerca = null;
      actual.lineas.push(linea);
      continue;
    }
    if (!cerca) {
      const marcador = linea.match(/^\s*<!--\s*bloque:\s*(cuando-consultar|riesgo|aviso)\s*-->\s*$/i);
      let siguiente = i + 1;
      while (siguiente < lineas.length && !lineas[siguiente].trim()) siguiente += 1;
      if (marcador && /^##\s/.test(lineas[siguiente] || "")) {
        if (actual.lineas.join("\n").trim()) secciones.push(actual);
        actual = { bloque: marcador[1].toLowerCase(), lineas: [] };
        i = siguiente - 1;
        continue;
      }
      if (/^##\s/.test(linea) && actual.bloque && actual.lineas.length) {
        secciones.push(actual);
        actual = { bloque: null, lineas: [] };
      }
    }
    actual.lineas.push(linea);
  }
  if (actual.lineas.join("\n").trim()) secciones.push(actual);
  return secciones.map(({ bloque, lineas: contenido }) => ({ bloque, markdown: contenido.join("\n").trim() }));
}

export function variablesHub(markdown, { precio = "", duracion = "", whatsapp = "" }) {
  const valores = { precio_sesion: precio, duracion_sesion: duracion, whatsapp };
  return String(markdown || "").replace(/\{\{\s*(precio_sesion|duracion_sesion|whatsapp)\s*\}\}/g, (_, clave) => String(valores[clave] ?? ""));
}

/** Agrupa el árbol completo: las referencias Markdown siguen siendo globales. */
export function remarkBloquesHub() {
  return (tree) => {
    const salida = [];
    let caja = null;
    for (let i = 0; i < tree.children.length; i += 1) {
      const nodo = tree.children[i];
      const marca = nodo.type === "html" && nodo.value.match(/^\s*<!--\s*bloque:\s*(cuando-consultar|riesgo|aviso)\s*-->\s*$/i);
      if (marca) {
        const siguiente = tree.children[i + 1];
        if (siguiente?.type === "heading" && siguiente.depth === 2) {
          caja = {
            type: "hubSection",
            data: { hName: "section", hProperties: { "data-bloque": marca[1].toLowerCase(), className: ["my-8", "rounded-nv", "border-l-4", "border-nv-teal-mid", "bg-nv-cream-hi", "p-6", "[&>h2:first-child]:mt-0", "[&>:last-child]:mb-0"] } },
            children: [siguiente],
          };
          salida.push(caja);
          i += 1;
        }
        continue;
      }
      if (nodo.type === "heading" && nodo.depth <= 2) caja = null;
      (caja ? caja.children : salida).push(nodo);
    }
    tree.children = salida;
  };
}

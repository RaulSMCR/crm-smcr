// tests/unit/cambios-de-formulario.test.js
import { describe, it, expect } from "vitest";
import {
  diferenciasDeFormulario,
  firmaDeLineas,
  leerFormulario,
  mismoValor,
  textoDeValor,
} from "../../src/lib/cambios-de-formulario.js";

const CAMPOS = {
  title: { etiqueta: "Título" },
  noindex: { etiqueta: "No indexar", tipo: "casilla" },
  enabledFunctions: { etiqueta: "Funciones visibles", tipo: "lista" },
};

/**
 * Un doble de formulario con la única interfaz que usa la lectura:
 * `elements.namedItem(nombre)`, que devuelve un nodo o una lista.
 */
function formulario(controles = {}) {
  const nodos = {};
  for (const [nombre, valor] of Object.entries(controles)) {
    if (Array.isArray(valor)) {
      const lista = valor.map((item) => ({ value: item.value, checked: item.checked === true }));
      lista.length = valor.length;
      nodos[nombre] = lista; // sin `tagName`: se lee como RadioNodeList
    } else if (typeof valor === "boolean") {
      nodos[nombre] = { tagName: "INPUT", checked: valor, value: "on" };
    } else {
      nodos[nombre] = { tagName: "INPUT", value: valor };
    }
  }
  return { elements: { namedItem: (nombre) => nodos[nombre] ?? null } };
}

describe("leer un formulario", () => {
  it("lee texto, casillas y grupos de casillas", () => {
    const form = formulario({
      title: "Ataques de pánico",
      noindex: true,
      enabledFunctions: [
        { value: "agenda", checked: true },
        { value: "whatsapp", checked: false },
        { value: "topics", checked: true },
      ],
    });
    expect(leerFormulario(form, CAMPOS)).toEqual({
      title: "Ataques de pánico",
      noindex: true,
      enabledFunctions: ["agenda", "topics"],
    });
  });

  it("solo mira los campos del mapa", () => {
    // Dentro del formulario de un módulo vive el bloque de ingesta de `.md`: si
    // se leyera «todo lo que haya», elegir un archivo contaría como una edición
    // del módulo.
    const form = formulario({ title: "Un módulo", archivoDeIngesta: "duelo.md" });
    expect(Object.keys(leerFormulario(form, { title: { etiqueta: "Título" } }))).toEqual(["title"]);
  });

  it("da valores neutros cuando el campo no está en pantalla", () => {
    expect(leerFormulario(formulario({}), CAMPOS)).toEqual({ title: "", noindex: false, enabledFunctions: [] });
    expect(leerFormulario(null, CAMPOS)).toEqual({ title: "", noindex: false, enabledFunctions: [] });
  });
});

describe("comparar valores", () => {
  it("trata null, undefined y cadena vacía como el mismo valor", () => {
    expect(mismoValor(null, "")).toBe(true);
    expect(mismoValor(undefined, "")).toBe(true);
    expect(mismoValor("", "algo")).toBe(false);
  });

  it("en una lista mira el conjunto y no el orden", () => {
    expect(mismoValor(["agenda", "topics"], ["topics", "agenda"])).toBe(true);
    expect(mismoValor(["agenda"], ["agenda", "topics"])).toBe(false);
  });
});

describe("diferencias", () => {
  const base = { title: "Ataques de pánico", noindex: false, enabledFunctions: ["agenda"] };

  it("no reporta nada si no se tocó nada", () => {
    expect(diferenciasDeFormulario(base, { ...base }, CAMPOS)).toEqual([]);
  });

  it("no cuenta pasar de null a cadena vacía", () => {
    const campos = { whatsapp: { etiqueta: "WhatsApp" } };
    expect(diferenciasDeFormulario({ whatsapp: null }, { whatsapp: "" }, campos)).toEqual([]);
  });

  it("nombra el campo y dice el antes y el después", () => {
    const lineas = diferenciasDeFormulario(base, { ...base, title: "Crisis de angustia", noindex: true }, CAMPOS);
    expect(lineas).toEqual([
      { campo: "title", etiqueta: "Título", antes: "Ataques de pánico", despues: "Crisis de angustia" },
      { campo: "noindex", etiqueta: "No indexar", antes: "no", despues: "sí" },
    ]);
  });

  it("describe las listas por sus valores", () => {
    const [linea] = diferenciasDeFormulario(base, { ...base, enabledFunctions: [] }, CAMPOS);
    expect(linea).toMatchObject({ campo: "enabledFunctions", antes: "agenda", despues: "(ninguna)" });
  });
});

describe("texto de un valor", () => {
  it("recorta lo largo, porque hay campos que son un artículo entero", () => {
    const texto = textoDeValor("a".repeat(200));
    expect(texto).toHaveLength(91);
    expect(texto.endsWith("…")).toBe(true);
  });

  it("aplasta los saltos de línea para que la barra no crezca", () => {
    expect(textoDeValor("una\nlínea\n\notra")).toBe("una línea otra");
  });

  it("dice «(vacío)» en vez de no decir nada", () => {
    expect(textoDeValor("")).toBe("(vacío)");
    expect(textoDeValor(null)).toBe("(vacío)");
    expect(textoDeValor("   ")).toBe("(vacío)");
  });
});

describe("firma de líneas", () => {
  it("cambia cuando cambia lo escrito y no cuando no", () => {
    const lineas = [{ campo: "title", etiqueta: "Título", antes: "a", despues: "b" }];
    expect(firmaDeLineas(lineas)).toBe(firmaDeLineas([{ ...lineas[0] }]));
    expect(firmaDeLineas(lineas)).not.toBe(firmaDeLineas([{ ...lineas[0], despues: "c" }]));
  });
});

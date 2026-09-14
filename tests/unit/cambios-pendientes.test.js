// tests/unit/cambios-pendientes.test.js
import { describe, it, expect } from "vitest";
import {
  cambiosPorEntidad,
  contarCambios,
  informeDeGuardado,
  registrarCambio,
  tieneCambios,
  valorDe,
} from "../../src/lib/cambios-pendientes.js";

const edicion = (extra = {}) => ({
  tipo: "serie", id: "s1", nombre: "Una serie",
  campo: "name", etiqueta: "Nombre", antes: "Una serie", despues: "Otra serie",
  ...extra,
});

describe("registrar cambios", () => {
  it("guarda el antes y el después", () => {
    const p = registrarCambio({}, edicion());
    expect(contarCambios(p)).toBe(1);
    expect(valorDe(p, "serie", "s1", "name", "Una serie")).toBe("Otra serie");
  });

  it("no muta el mapa anterior", () => {
    const antes = {};
    registrarCambio(antes, edicion());
    expect(antes).toEqual({});
  });

  it("si el valor vuelve al original, el cambio desaparece", () => {
    // Escribir algo y arrepentirse no debe dejar un cambio pendiente fantasma
    // que el contador siga sumando.
    let p = registrarCambio({}, edicion());
    p = registrarCambio(p, edicion({ despues: "Una serie" }));
    expect(contarCambios(p)).toBe(0);
    expect(tieneCambios(p, "serie", "s1")).toBe(false);
  });

  it("trata null, undefined y cadena vacía como el mismo valor", () => {
    // Un campo de texto opcional que estaba en null y se toca sin escribir nada
    // no es una edición.
    const p = registrarCambio({}, edicion({ campo: "description", antes: null, despues: "" }));
    expect(contarCambios(p)).toBe(0);
  });

  it("acumula varios campos de la misma entidad", () => {
    let p = registrarCambio({}, edicion());
    p = registrarCambio(p, edicion({ campo: "description", etiqueta: "Descripción", antes: "", despues: "Nueva" }));
    expect(contarCambios(p)).toBe(2);
    expect(Object.keys(p)).toHaveLength(1);
  });

  it("acumula entidades distintas por separado", () => {
    let p = registrarCambio({}, edicion());
    p = registrarCambio(p, edicion({ tipo: "tema", id: "t1", nombre: "Duelo", antes: "Duelo", despues: "El duelo" }));
    expect(Object.keys(p)).toHaveLength(2);
    expect(contarCambios(p)).toBe(2);
  });

  it("conserva el nombre original aunque se renombre en la misma tanda", () => {
    let p = registrarCambio({}, edicion());
    p = registrarCambio(p, edicion({ nombre: "Otra serie", campo: "isActive", etiqueta: "Visibilidad", antes: true, despues: false }));
    expect(cambiosPorEntidad(p)[0].nombre).toBe("Una serie");
  });

  it("ignora un cambio sin identidad", () => {
    expect(registrarCambio({}, { campo: "name" })).toEqual({});
    expect(registrarCambio({}, {})).toEqual({});
  });
});

describe("cambios por entidad", () => {
  it("arma el patch que recibe la acción del servidor", () => {
    let p = registrarCambio({}, edicion());
    p = registrarCambio(p, edicion({ campo: "isActive", etiqueta: "Visibilidad", antes: true, despues: false, antesTexto: "Visible", despuesTexto: "Oculta" }));
    const [entidad] = cambiosPorEntidad(p);
    expect(entidad.patch).toEqual({ name: "Otra serie", isActive: false });
    expect(entidad.lineas).toEqual([
      { campo: "name", etiqueta: "Nombre", antes: "Una serie", despues: "Otra serie" },
      { campo: "isActive", etiqueta: "Visibilidad", antes: "Visible", despues: "Oculta" },
    ]);
  });

  it("describe los valores vacíos en castellano, no como null", () => {
    const p = registrarCambio({}, edicion({ campo: "description", etiqueta: "Descripción", antes: null, despues: "Algo" }));
    expect(cambiosPorEntidad(p)[0].lineas[0].antes).toBe("(vacío)");
  });
});

describe("informe de guardado", () => {
  const ok = { nombre: "Una serie", lineas: [{}, {}] };
  const falla = { nombre: "Otra", lineas: [{}], error: "Ya existe una serie con ese nombre." };

  it("cuenta campos y elementos cuando todo sale bien", () => {
    const informe = informeDeGuardado([ok]);
    expect(informe.resumen).toBe("Se guardaron 2 cambios en 1 elemento.");
    expect(informe.hayFallas).toBe(false);
  });

  it("no da por guardado lo que el servidor rechazó", () => {
    // Un informe que lista como guardado algo que falló es peor que no tenerlo.
    const informe = informeDeGuardado([ok, falla]);
    expect(informe.campos).toBe(2);
    expect(informe.hayFallas).toBe(true);
    expect(informe.fallidos).toHaveLength(1);
    expect(informe.resumen).toContain("1 elemento falló");
  });

  it("lo dice claro cuando no se guardó nada", () => {
    expect(informeDeGuardado([falla]).resumen).toBe("No se pudo guardar el cambio.");
    expect(informeDeGuardado([]).resumen).toBe("No había cambios que guardar.");
  });

  it("concuerda el singular", () => {
    expect(informeDeGuardado([{ nombre: "x", lineas: [{}] }]).resumen).toBe("Se guardó 1 cambio en 1 elemento.");
  });
});

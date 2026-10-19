import { describe, expect, it } from "vitest";
import { causaHacienda } from "@/lib/fe/client.js";

// Los errores de la consulta de estado de Hacienda llegan con
// `content-length: 0`: el cuerpo está vacío y el único texto que explica algo
// viaja en el encabezado `X-Error-Cause`. Verificado el 2026-10-19 contra
// api-sandbox, que responde HTTP 400 con
// «El comprobante [<clave>] no ha sido recibido.».
//
// Sin leerlo, una factura trabada solo decía FE_STATUS_UNAVAILABLE: la 0189
// estuvo un mes así mientras Hacienda venía diciendo el motivo en cada respuesta.
describe("causaHacienda", () => {
  const respuesta = (headers) => new Response(null, { status: 400, headers });

  it("lee el encabezado que Hacienda usa para explicar el error", () => {
    const causa = causaHacienda(
      respuesta({ "x-error-cause": "El comprobante [50619092600310188566100100001010000000189122449356] no ha sido recibido." }),
    );
    expect(causa).toBe("El comprobante [50619092600310188566100100001010000000189122449356] no ha sido recibido.");
  });

  it("devuelve cadena vacía cuando el encabezado no viene", () => {
    expect(causaHacienda(respuesta({}))).toBe("");
    expect(causaHacienda(undefined)).toBe("");
    expect(causaHacienda({})).toBe("");
  });

  it("colapsa espacios repetidos y recorta los de los extremos", () => {
    // Va a parar a feErrorMessage, que se muestra en una línea del panel.
    expect(causaHacienda(respuesta({ "x-error-cause": "   dos    palabras   " }))).toBe("dos palabras");
  });

  it("también colapsa saltos de línea, que no pueden llegar por HTTP", () => {
    // La API de Headers rechaza un valor con saltos de línea, así que este caso
    // no puede venir de una respuesta real y se prueba con un doble. El saneo se
    // conserva igual: el destino es un campo de una línea y no se confía en que
    // el transporte sea el único que lo garantice.
    expect(causaHacienda({ headers: { get: () => "dos\n\tlíneas" } })).toBe("dos líneas");
  });

  it("recorta a 300 caracteres: es un mensaje operativo, no un volcado", () => {
    const largo = causaHacienda(respuesta({ "x-error-cause": "x".repeat(900) }));
    expect(largo).toHaveLength(300);
  });
});

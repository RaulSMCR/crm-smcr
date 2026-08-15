// tests/integration/cabys-catalogo.test.js
//
// Comprueba contra Hacienda que el CABYS de cada servicio exista en el catálogo
// del BCCR. NO corre con `npm test` porque toca la red y emite comprobantes de
// prueba. Se activa así:
//
//   FE_SANDBOX_E2E=1 npx vitest run tests/integration/cabys-catalogo.test.js
//
// Por qué existe: un CABYS que no está en el catálogo no se puede detectar
// leyéndolo. Tiene el largo correcto, la forma correcta, y Hacienda lo rechaza
// con el error -400 recién al recibir el comprobante — o sea, después de que el
// paciente pagó. De nueve códigos homologados a mano, cinco resultaron
// inexistentes; ninguno se distinguía a simple vista de los válidos.
//
// Los errores -37 y -38 aparecen en toda respuesta del sandbox (su padrón de
// contribuyentes es independiente del real) y no dicen nada del CABYS.
import { describe, it, expect } from "vitest";

const ACTIVO = process.env.FE_SANDBOX_E2E === "1";

/** Factura mínima de un solo renglón, solo para que Hacienda juzgue el código. */
function comprobanteDePrueba(cabysCode, descripcion) {
  return {
    invoice: {
      // Rango alto para no chocar con la secuencia real de facturación.
      invoiceNumber: `9${String(Date.now()).slice(-6)}`,
      invoiceType: "CUSTOMER_INVOICE",
      invoiceDate: new Date(),
      dueDate: new Date(),
      paymentMethod: "card",
      currency: "CRC",
      contactName: "Verificación de catálogo",
      contactIdNumber: "112041024",
      contactIdType: "01",
      subtotal: 19230.77,
      taxAmount: 769.23,
      discountAmount: 0,
      total: 20000,
    },
    lines: [
      {
        quantity: 1,
        unitPrice: 19230.77,
        discountPercent: 0,
        taxRate: 4,
        taxAmount: 769.23,
        lineSubtotal: 19230.77,
        lineTotal: 20000,
        description: descripcion,
        cabysCode,
      },
    ],
  };
}

/** Hacienda rechaza con -400 el código que no figura en el catálogo. */
function fueraDelCatalogo(detalle) {
  return /-400/.test(String(detalle || ""));
}

describe.runIf(ACTIVO)("los CABYS de los servicios están en el catálogo", () => {
  it("ninguno da -400", async () => {
    const { prisma } = await import("@/lib/prisma");
    const { submitToHacienda } = await import("@/lib/fe/client");

    const servicios = await prisma.service.findMany({
      where: { cabysCode: { not: null } },
      select: { title: true, cabysCode: true },
      orderBy: { title: "asc" },
    });

    const rechazados = [];

    for (const { title, cabysCode } of servicios) {
      const { invoice, lines } = comprobanteDePrueba(cabysCode, title);
      let detalle = "";
      try {
        detalle = String((await submitToHacienda(invoice, lines)).feErrorMessage || "");
      } catch (error) {
        detalle = `EXCEPCION: ${error.message}`;
      }

      const veredicto = fueraDelCatalogo(detalle) ? "FUERA DEL CATALOGO" : "ok";
      console.log(`  ${veredicto.padEnd(18)} ${cabysCode}  ${title}`);
      if (fueraDelCatalogo(detalle)) rechazados.push(`${cabysCode} (${title})`);
    }

    await prisma.$disconnect();
    expect(rechazados, `CABYS inexistentes: ${rechazados.join(", ")}`).toEqual([]);
  }, 900_000);
});

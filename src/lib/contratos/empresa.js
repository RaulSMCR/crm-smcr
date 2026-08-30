// src/lib/contratos/empresa.js
//
// Los datos de la sociedad para el contrato.
//
// La razón social y la cédula jurídica salen de la misma configuración con la
// que se emite la factura electrónica (`FE_EMISOR`), y no de una copia aparte:
// si el contrato dijera una razón social y las facturas otra, una de las dos
// estaría mal y nadie se enteraría hasta que importara.
//
// El representante legal sí es propio del contrato —Hacienda no lo necesita— y
// vive en tres variables de entorno. Si faltan, el contrato sale con la línea en
// blanco y la pantalla lo dice: quién firma por la empresa y con qué facultades
// no es algo que el sistema pueda suponer.

import { FE_EMISOR } from "@/lib/fe/config";

const env = (nombre) => String(process.env[nombre] || "").trim();

export function datosEmpresaParaContrato() {
  return {
    nombre: FE_EMISOR.nombre,
    cedulaJuridica: FE_EMISOR.identificacion,
    correo: FE_EMISOR.correo,
    representante: {
      nombre: env("EMPRESA_REPRESENTANTE_NOMBRE"),
      identificacion: env("EMPRESA_REPRESENTANTE_CEDULA"),
      // Sin valor por defecto a propósito: "Apoderado Generalísimo sin límite de
      // suma" es una afirmación sobre las facultades de una persona real.
      condicion: env("EMPRESA_REPRESENTANTE_CONDICION"),
    },
  };
}

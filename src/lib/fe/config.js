// src/lib/fe/config.js
// Configuración del emisor y URLs de la API de Factura Electrónica de Hacienda CR.

import { assertAmbientesCoherentes, detectarAmbienteFe, detectarAmbienteOnvo } from "@/lib/fiscal-environment";

const env = (name) => String(process.env[name] || "").trim();

// Las reglas de formato viven acá, una sola vez, porque las leen dos caminos:
// `assertFeConfig`, que aborta la emisión, y `diagnosticarFeConfig`, que las
// reporta. Duplicadas, una se corregiría y la otra seguiría mintiendo.
const SOLO_DIGITOS = /^\d+$/;
const AMBIENTE_VALIDO = /^(01|02)$/;
// La 4.4 declara la actividad como NNNN.N (ej. 8690.9). Se admite tambien el
// formato viejo de 5 o 6 digitos: formatCodigoActividad() le pone el punto.
const ACTIVIDAD_VALIDA = /^\d{4,6}(\.\d)?$/;

/**
 * Las catorce variables del emisor que no pueden faltar, con su valor.
 *
 * Es una función y no una constante a propósito: `FE_EMISOR` se define más
 * abajo en el módulo, así que un arreglo de nivel superior se evaluaría antes
 * de que exista.
 */
function camposEmisorRequeridos() {
  return [
    ["FE_EMISOR_NOMBRE", FE_EMISOR.nombre], ["FE_EMISOR_TIPO_ID", FE_EMISOR.tipoIdentificacion],
    ["FE_EMISOR_IDENTIFICACION", FE_EMISOR.identificacion], ["FE_EMISOR_CORREO", FE_EMISOR.correo],
    ["FE_EMISOR_TEL_CODIGO", FE_EMISOR.telefono.codigoPais], ["FE_EMISOR_TEL_NUMERO", FE_EMISOR.telefono.numTelefono],
    ["FE_EMISOR_PROVINCIA", FE_EMISOR.ubicacion.provincia], ["FE_EMISOR_CANTON", FE_EMISOR.ubicacion.canton],
    ["FE_EMISOR_DISTRITO", FE_EMISOR.ubicacion.distrito], ["FE_EMISOR_OTRAS_SENAS", FE_EMISOR.ubicacion.otrasSenas],
    ["FE_EMISOR_ACTIVIDAD", FE_EMISOR.actividadEconomica], ["FE_EMISOR_SUCURSAL", FE_EMISOR.sucursal],
    ["FE_EMISOR_TERMINAL", FE_EMISOR.terminal], ["FE_AMBIENTE", FE_EMISOR.ambiente],
  ];
}

/** Las siete credenciales y URLs de la API, con su valor. */
function camposApiRequeridos() {
  return [
    ["FE_TOKEN_URL", FE_API.tokenUrl], ["FE_API_URL", FE_API.recepcionUrl],
    ["FE_CLIENT_ID", FE_API.clientId], ["FE_USERNAME", FE_API.username],
    ["FE_PASSWORD", FE_API.password], ["FE_P12_BASE64", FE_API.p12Base64],
    ["FE_P12_PIN", FE_API.p12Pin],
  ];
}

export function assertFeConfig() {
  const missing = camposEmisorRequeridos().filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Configuración FE incompleta: faltan ${missing.join(", ")}.`);
  if (!SOLO_DIGITOS.test(FE_EMISOR.identificacion)) throw new Error("FE_EMISOR_IDENTIFICACION debe ser numérica.");
  if (!AMBIENTE_VALIDO.test(FE_EMISOR.ambiente)) throw new Error("FE_AMBIENTE debe ser 01 o 02.");
  if (!ACTIVIDAD_VALIDA.test(FE_EMISOR.actividadEconomica)) {
    throw new Error("FE_EMISOR_ACTIVIDAD debe ser NNNN.N (ej. 8690.9) o de 5 a 6 dígitos.");
  }
  if (!SOLO_DIGITOS.test(FE_EMISOR.proveedorSistemas)) {
    throw new Error("FE_PROVEEDOR_SISTEMAS debe ser numérica.");
  }
  if (FE_EMISOR.ambiente === "01" && process.env.NODE_ENV !== "production") {
    throw new Error("No se permite ambiente fiscal de producción fuera de producción.");
  }
  assertAmbientesCoherentes({ feAmbiente: FE_EMISOR.ambiente });

  if (camposApiRequeridos().some(([, value]) => !value)) {
    throw new Error("Configuración FE_API incompleta: revise URLs, credenciales y certificado.");
  }
  return true;
}

/**
 * Qué falta o qué está mal en la configuración fiscal, sin lanzar.
 *
 * Existe por un efecto secundario deliberado del diseño: `submitInvoiceToFe`
 * atrapa lo que lanza `assertFeConfig` y lo reduce a `FE_ERROR_NO_CLASIFICADO`,
 * porque el texto de una excepción puede arrastrar datos del comprobante y no
 * debe publicarse. El precio era que una factura trabada no decía qué variable
 * faltaba, y había que cotejar veintiuna a mano contra el panel de Vercel.
 *
 * Devuelve SOLO nombres de variables y veredictos. Nunca un valor, ni un
 * fragmento, ni una longitud: con la lista de nombres se arregla el despliegue;
 * con un valor se filtra una credencial de Hacienda. Por eso tampoco se
 * reutiliza el mensaje de las excepciones, que sí puede traer contenido.
 */
export function diagnosticarFeConfig() {
  const faltantesEmisor = camposEmisorRequeridos().filter(([, v]) => !v).map(([name]) => name);
  const faltantesApi = camposApiRequeridos().filter(([, v]) => !v).map(([name]) => name);

  // Una regla no se evalúa si su variable falta: ya está reportada como ausente
  // y decir además que tiene mal formato es ruido sobre el mismo problema.
  const reglas = [
    ["FE_EMISOR_IDENTIFICACION", FE_EMISOR.identificacion, SOLO_DIGITOS, "solo dígitos, sin guiones"],
    ["FE_AMBIENTE", FE_EMISOR.ambiente, AMBIENTE_VALIDO, "01 (producción) o 02 (pruebas)"],
    ["FE_EMISOR_ACTIVIDAD", FE_EMISOR.actividadEconomica, ACTIVIDAD_VALIDA, "NNNN.N (ej. 8690.9) o 5 a 6 dígitos"],
  ];

  // `FE_PROVEEDOR_SISTEMAS` hereda `FE_EMISOR_IDENTIFICACION` cuando no se
  // declara. Sin esta condición, un guion en la identificación salía reportado
  // dos veces —y la segunda señalaba una variable que quizá nadie configuró—,
  // mandando a revisar dos cosas donde hay una sola.
  if (env("FE_PROVEEDOR_SISTEMAS")) {
    reglas.push(["FE_PROVEEDOR_SISTEMAS", FE_EMISOR.proveedorSistemas, SOLO_DIGITOS, "solo dígitos"]);
  }

  const formato = reglas
    .filter(([, valor, regla]) => valor && !regla.test(valor))
    .map(([variable, , , regla]) => ({ variable, regla }));

  const ambienteFe = detectarAmbienteFe(FE_EMISOR.ambiente);
  const ambienteOnvo = detectarAmbienteOnvo(process.env.ONVO_SECRET_KEY);
  const mixtoPermitido = process.env.FISCAL_AMBIENTE_MIXTO === "1";
  const produccionFueraDeProduccion =
    FE_EMISOR.ambiente === "01" && process.env.NODE_ENV !== "production";

  let problemaAmbiente = null;
  if (ambienteOnvo === "produccion" && !ambienteFe) {
    problemaAmbiente = "ONVO cobra en producción y FE_AMBIENTE no está definida: se cobraría dinero real sin poder emitir el comprobante.";
  } else if (ambienteFe && ambienteOnvo && ambienteFe !== ambienteOnvo && !mixtoPermitido) {
    problemaAmbiente = `Incoherencia: los cobros están en ${ambienteOnvo} y la facturación en ${ambienteFe}. La emisión se aborta hasta alinearlos o declarar FISCAL_AMBIENTE_MIXTO=1.`;
  } else if (produccionFueraDeProduccion) {
    problemaAmbiente = "FE_AMBIENTE=01 exige NODE_ENV=production. Fuera de producción la emisión se aborta.";
  }

  return {
    completa: !faltantesEmisor.length && !faltantesApi.length && !formato.length && !problemaAmbiente,
    faltantes: { emisor: faltantesEmisor, api: faltantesApi },
    formato,
    ambiente: {
      fe: ambienteFe,
      cobros: ambienteOnvo,
      coherente: ambienteFe && ambienteOnvo ? ambienteFe === ambienteOnvo : null,
      mixtoPermitido,
      problema: problemaAmbiente,
    },
  };
}

export const FE_EMISOR = {
  nombre:              env("FE_EMISOR_NOMBRE"),
  tipoIdentificacion:  env("FE_EMISOR_TIPO_ID"),
  identificacion:      env("FE_EMISOR_IDENTIFICACION"),
  correo:              env("FE_EMISOR_CORREO"),
  telefono: {
    codigoPais:   env("FE_EMISOR_TEL_CODIGO"),
    numTelefono:  env("FE_EMISOR_TEL_NUMERO"),
  },
  ubicacion: {
    provincia:   env("FE_EMISOR_PROVINCIA"),
    canton:      env("FE_EMISOR_CANTON"),
    distrito:    env("FE_EMISOR_DISTRITO"),
    barrio:      env("FE_EMISOR_BARRIO"),
    otrasSenas:  env("FE_EMISOR_OTRAS_SENAS"),
  },
  actividadEconomica: env("FE_EMISOR_ACTIVIDAD"),

  /// Cedula de quien desarrolla el sistema emisor. Campo nuevo y obligatorio en
  /// la version 4.4. Al emitir con software propio es la cedula del propio
  /// emisor, asi que ese es el valor por defecto.
  proveedorSistemas: env("FE_PROVEEDOR_SISTEMAS") || env("FE_EMISOR_IDENTIFICACION"),
  sucursal:  env("FE_EMISOR_SUCURSAL"),
  terminal:  env("FE_EMISOR_TERMINAL"),
  ambiente: env("FE_AMBIENTE"),
};

export const FE_API = {
  tokenUrl:     process.env.FE_TOKEN_URL     || "",
  recepcionUrl: process.env.FE_API_URL       || "",
  clientId:     process.env.FE_CLIENT_ID     || "",
  username:     process.env.FE_USERNAME      || "",
  password:     process.env.FE_PASSWORD      || "",
  p12Base64:    process.env.FE_P12_BASE64    || "",
  p12Pin:       process.env.FE_P12_PIN       || "",
};

// Tipo documento FE → código de 2 dígitos
export const TIPO_DOC_MAP = {
  CUSTOMER_INVOICE:       "01",  // FacturaElectronica
  CUSTOMER_CREDIT_NOTE:   "03",  // NotaCreditoElectronica
  SUPPLIER_INVOICE:       "08",  // Proveedor (no emitida por nosotros)
  SUPPLIER_CREDIT_NOTE:   "03",  // Nota de crédito que referencia una FEC
  TIQUETE_ELECTRONICO:    "04",
  NOTA_DEBITO:             "02",
};

// Método de pago → código Hacienda
export const MEDIO_PAGO_MAP = {
  cash:         "01",
  efectivo:     "01",
  card:         "02",
  tarjeta:      "02",
  credit_card:  "02",
  check:        "03",
  cheque:       "03",
  transfer:     "04",
  transferencia:"04",
  wire:         "04",
  other:        "99",
  otros:        "99",
};

// Namespace del XML según tipo de documento
export const NS_MAP = {
  "01": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica",
  "03": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaCreditoElectronica",
  "02": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/notaDebitoElectronica",
  "04": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/tiqueteElectronico",
  "08": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaCompra",
  "09": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronicaExportacion",
};

// Elemento raíz según tipo de documento
export const ROOT_ELEMENT_MAP = {
  "01": "FacturaElectronica",
  "03": "NotaCreditoElectronica",
  "02": "NotaDebitoElectronica",
  "04": "TiqueteElectronico",
  "08": "FacturaElectronicaCompra",
  "09": "FacturaElectronicaExportacion",
};

// src/lib/fe/config.js
// Configuración del emisor y URLs de la API de Factura Electrónica de Hacienda CR.

const env = (name) => String(process.env[name] || "").trim();

export function assertFeConfig() {
  const required = [
    ["FE_EMISOR_NOMBRE", FE_EMISOR.nombre], ["FE_EMISOR_TIPO_ID", FE_EMISOR.tipoIdentificacion],
    ["FE_EMISOR_IDENTIFICACION", FE_EMISOR.identificacion], ["FE_EMISOR_CORREO", FE_EMISOR.correo],
    ["FE_EMISOR_TEL_CODIGO", FE_EMISOR.telefono.codigoPais], ["FE_EMISOR_TEL_NUMERO", FE_EMISOR.telefono.numTelefono],
    ["FE_EMISOR_PROVINCIA", FE_EMISOR.ubicacion.provincia], ["FE_EMISOR_CANTON", FE_EMISOR.ubicacion.canton],
    ["FE_EMISOR_DISTRITO", FE_EMISOR.ubicacion.distrito], ["FE_EMISOR_OTRAS_SENAS", FE_EMISOR.ubicacion.otrasSenas],
    ["FE_EMISOR_ACTIVIDAD", FE_EMISOR.actividadEconomica], ["FE_EMISOR_SUCURSAL", FE_EMISOR.sucursal],
    ["FE_EMISOR_TERMINAL", FE_EMISOR.terminal], ["FE_AMBIENTE", FE_EMISOR.ambiente],
  ];
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Configuración FE incompleta: faltan ${missing.join(", ")}.`);
  if (!/^\d+$/.test(FE_EMISOR.identificacion)) throw new Error("FE_EMISOR_IDENTIFICACION debe ser numérica.");
  if (!/^(01|02)$/.test(FE_EMISOR.ambiente)) throw new Error("FE_AMBIENTE debe ser 01 o 02.");
  if (!/^\d{5,6}$/.test(FE_EMISOR.actividadEconomica)) throw new Error("FE_EMISOR_ACTIVIDAD debe tener 5 o 6 dígitos.");
  if (FE_EMISOR.ambiente === "01" && process.env.NODE_ENV !== "production") {
    throw new Error("No se permite ambiente fiscal de producción fuera de producción.");
  }
  if (!FE_API.tokenUrl || !FE_API.recepcionUrl || !FE_API.clientId || !FE_API.username || !FE_API.password || !FE_API.p12Base64 || !FE_API.p12Pin) {
    throw new Error("Configuración FE_API incompleta: revise URLs, credenciales y certificado.");
  }
  return true;
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
    otrasSenas:  env("FE_EMISOR_OTRAS_SENAS"),
  },
  actividadEconomica: env("FE_EMISOR_ACTIVIDAD"),
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
  "01": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronica",
  "03": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/notaCreditoElectronica",
  "02": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/notaDebitoElectronica",
  "04": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/tiqueteElectronico",
  "08": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronicaCompra",
  "09": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/facturaElectronicaExportacion",
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

// src/lib/fe/config.js
// Constantes del Emisor y URLs de la API de Factura Electrónica de Hacienda CR.

export const FE_EMISOR = {
  nombre:              "SALUD MENTAL COSTA RICA CINCO CERO SEIS SOCIEDAD ANONIMA",
  tipoIdentificacion:  "02",            // 02 = Cédula Jurídica
  identificacion:      "3101885661",
  correo:              "raul.olmedo@gmail.com",
  telefono: {
    codigoPais:   "506",
    numTelefono:  "71291909",
  },
  ubicacion: {
    provincia:   "1",
    canton:      "18",
    distrito:    "01",
    otrasSenas:  "Oficentro Del Prado",
  },
  actividadEconomica: "86909",
  sucursal:  "001",
  terminal:  "00001",
  // Para producción cambiar esta línea:
  // ambiente: "01" = producción, "02" = pruebas
  ambiente: "02",
};

export const FE_API = {
  tokenUrl:     process.env.FE_TOKEN_URL     || "",
  recepcionUrl: process.env.FE_API_URL       || "",
  clientId:     process.env.FE_CLIENT_ID     || "api-stag",
  username:     process.env.FE_USERNAME      || "",
  password:     process.env.FE_PASSWORD      || "",
  p12Base64:    process.env.FE_P12_BASE64    || "",
  p12Pin:       process.env.FE_P12_PIN       || "1234",
};

// Tipo documento FE → código de 2 dígitos
export const TIPO_DOC_MAP = {
  CUSTOMER_INVOICE:       "01",  // FacturaElectronica
  CUSTOMER_CREDIT_NOTE:   "03",  // NotaCreditoElectronica
  SUPPLIER_INVOICE:       "08",  // Proveedor (no emitida por nosotros)
  SUPPLIER_CREDIT_NOTE:   "09",
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
  "08": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/tiqueteElectronico",
  "09": "https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/notaDebitoElectronica",
};

// Elemento raíz según tipo de documento
export const ROOT_ELEMENT_MAP = {
  "01": "FacturaElectronica",
  "03": "NotaCreditoElectronica",
  "08": "TiqueteElectronico",
  "09": "NotaDebitoElectronica",
};

# T14 — Mapeo de migración FE v4.3 → v4.4

Estado: fase 1 de investigación. No se modifica código FE hasta validación del contador.

## 1. Cambios verificados

Fuente primaria: [Anexos y Estructuras v4.4, Ministerio de Hacienda](https://www.hacienda.go.cr/docs/ANEXOS_Y_ESTRUCTURAS_V4.4.pdf), bitácora de cambios actualizada al 22/04/2026. El documento indica que v4.4 rige desde el 01/09/2025 y que v4.3 solo queda para notas de crédito/débito que ajusten comprobantes emitidos durante su vigencia.

| Área | Cambio v4.3 → v4.4 | Impacto CRM |
|---|---|---|
| Identificación | Se aclara que la identificación puede contener caracteres alfanuméricos para personas jurídicas. | No asumir que `User.identification` siempre es numérica; revisar validaciones y XML del receptor. |
| Teléfono | Se agrega excepción para números especiales como `911`. | Mantener validación flexible en emisor/receptor. |
| Información de referencia | Se agregan códigos 13–17 y se ajusta el código 12; también aparecen códigos 19–20. | Actualizar catálogo cuando el contador confirme el significado usado para notas. |
| Encabezado | Se incluye `Proveedor de Sistemas`. | Agregar configuración del proveedor y nodo XML. |
| Clave/consecutivo | La resolución actualiza la codificación documentada e incorpora el tipo 10. | Verificar longitud y posiciones contra los XSD antes de cambiar `buildFeClave`/`buildFeNumber`. |
| Comprobantes | Se agrega `Recibo Electrónico de Pago` código 10. | No emitirlo todavía: requiere confirmar si el flujo de pagos diferidos del CRM lo hace obligatorio. |
| XSD | Se incorporan referencias de esquema para FEC, exportación y Recibo de Pago. | Añadir namespaces/raíces solo en fase 2, con golden files. |

No se verificó en la fuente consultada un listado exhaustivo de todos los campos eliminados, renombrados, unidades de medida, medios de pago o tipos de identificación. Deben contrastarse directamente con los XSD v4.4 publicados por Hacienda antes de codificar.

## 2. Impacto por archivo

- `src/lib/fe/xml.js`: cambiar namespaces, raíces, campos nuevos y catálogos; revisar `InformacionReferencia`, identificación alfanumérica y `ProveedorDeSistemas`.
- `src/lib/fe/config.js`: versionar URLs/namespace v4.4 y agregar configuración del proveedor de sistemas. T10 y T12 deben estar estabilizadas primero.
- `src/lib/fe/client.js`: confirmar endpoints v4.4, payload de recepción, longitud de `clave` y respuesta de aceptación.
- `src/lib/fe/signer.js`: no se observó un cambio verificado en la firma; validar compatibilidad con el XSD antes de tocarlo.
- `src/lib/fe/submit.js`: conservar estados/idempotencia, añadir manejo de documentos nuevos y respuestas del receptor cuando el contador valide el flujo.

## 3. Datos faltantes por confirmar

El modelo actual tiene emisor configurable, receptor básico, líneas, CABYS y tasas. Falta confirmar si v4.4 exige persistir: proveedor de sistemas, identificación alfanumérica del receptor, actividad económica del receptor, condición/medio de pago ampliados, códigos de referencia adicionales y datos específicos del Recibo de Pago. La migración Prisma queda pendiente hasta tener esa lista confirmada.

## 4. Endpoints y autenticación

La [API oficial de Comprobantes Electrónicos](https://www.hacienda.go.cr/docs/ComprobantesElectronicosAPI.html) publica el endpoint de recepción `https://api.comprobanteselectronicos.go.cr/recepcion/v1/` y autenticación OIDC/Bearer. La URL de staging específica y cualquier cambio de client ID/token para v4.4 no quedó verificable en la documentación pública consultada; mantenerlo como pendiente y no inferir valores.

## 5. Preguntas cerradas para el contador

1. ¿El CRM debe emitir Factura Electrónica 01 para todo paciente identificado, sí o no?
2. ¿Debe emitir Tiquete Electrónico 04 cuando el paciente no aporta identificación, sí o no?
3. ¿El proveedor de sistemas será el propio CRM, sí o no? Si no, indique nombre e identificación.
4. ¿El Recibo Electrónico de Pago 10 aplica a pagos posteriores a una factura a crédito en este negocio, sí o no?
5. Para una FEC 08 emitida por el sitio en nombre propio, ¿la nota de crédito del proveedor debe usar tipo 03 y referenciar la FEC, sí o no?
6. ¿Qué códigos de `InformacionReferencia` deben usarse para anulación, devolución y corrección, indique código por caso?
7. ¿Se acepta tipo de cambio 1.00 únicamente porque el CRM opera en CRC, sí o no?
8. ¿Qué condiciones de venta y medios de pago deben enviarse para pagos ONVO con tarjeta?
9. ¿Qué CABYS corresponde a cada servicio del catálogo actual? Entregue código de 13 dígitos por servicio.
10. ¿La actividad económica del receptor debe almacenarse y enviarse, sí o no?

## 6. Plan de fase 2

1. Confirmar con el contador catálogo, XSD y preguntas de esta fase.
2. Descargar XSD v4.4 oficiales y fijar namespaces/raíces en tests.
3. Actualizar `config.js` y agregar `ProveedorDeSistemas`.
4. Ajustar `xml.js` para Factura 01, Nota de Crédito 03 y FEC 08.
5. Añadir campos Prisma confirmados y migración.
6. Actualizar `client.js`/`submit.js` y probar autenticación en staging 02.
7. Crear golden file de factura con IVA 4%.
8. Crear golden file de nota de crédito.
9. Crear golden file de factura de compra.
10. Ejecutar prueba real únicamente contra staging con certificado de pruebas.
11. Revisar XML y respuestas con el contador.
12. Preparar despliegue a producción solo después de aceptación formal.


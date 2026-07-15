# T10 — Corregir catálogo de tipos de documento FE (FIS-03) ⚠ validar tabla final con el contador

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript). Facturación electrónica de Hacienda CR implementada en `src/lib/fe/` (`config.js` constantes, `xml.js` construcción del XML y clave numérica, `signer.js` firma XAdES, `client.js` envío, `submit.js` orquestación).

## Reglas duras
1. Alcance: SOLO `src/lib/fe/config.js`, `src/lib/fe/xml.js` (si referencia los mapas) y tests nuevos.
2. Verifica cada código contra el anexo oficial de comprobantes electrónicos del Ministerio de Hacienda (resoluciones y anexos en https://www.hacienda.go.cr / cdn.comprobanteselectronicos.go.cr). Si no puedes acceder a la fuente oficial, dilo explícitamente y marca la tabla como «pendiente de validación» — no inventes.
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
En `src/lib/fe/config.js` los mapas están cruzados. Hoy: `TIPO_DOC_MAP` asigna `SUPPLIER_INVOICE → "08"` y `SUPPLIER_CREDIT_NOTE → "09"`, mientras `NS_MAP`/`ROOT_ELEMENT_MAP` asocian `"08" → TiqueteElectronico` y `"09" → NotaDebitoElectronica`. El catálogo oficial de Hacienda es (verificar): `01` Factura electrónica, `02` Nota de débito, `03` Nota de crédito, `04` Tiquete electrónico, `08` Factura electrónica de compra (FEC), `09` Factura electrónica de exportación. Con los mapas actuales, cualquier documento distinto de la factura de cliente se generaría con código/namespace/raíz incorrectos y sería rechazado.

## Pasos

1. Lee completos `config.js`, `xml.js` y `submit.js`; identifica todos los usos de `TIPO_DOC_MAP`, `NS_MAP` y `ROOT_ELEMENT_MAP` (también en la construcción de la clave numérica y el consecutivo, donde el tipo de documento va embebido).
2. Corrige las tres tablas para que código ↔ namespace ↔ elemento raíz sean coherentes con el catálogo oficial. Los tipos internos del CRM mapean así:
   - `CUSTOMER_INVOICE → 01` (FacturaElectronica)
   - `CUSTOMER_CREDIT_NOTE → 03` (NotaCreditoElectronica)
   - `SUPPLIER_INVOICE → 08` (FacturaElectronicaCompra — la emite el CRM cuando el proveedor no factura; verifica elemento raíz y namespace propios de la FEC)
   - `SUPPLIER_CREDIT_NOTE` → analiza y propone: probablemente nota de crédito (03) referenciando la FEC, no un tipo 09. Documenta tu decisión con la fuente.
3. Añade el mapeo del `DocumentType` del schema (`TIQUETE_ELECTRONICO → 04`, `NOTA_DEBITO → 02`) aunque aún no se usen, con comentario.
4. Test `tests/unit/fe-config.test.js` que **fije** cada tripleta código/namespace/raíz (snapshot explícito, no genérico) y valide que `buildFeClave`/`buildFeNumber` usan el código correcto según tipo.
5. En el resumen final: tabla Markdown con el mapeo final y la fuente oficial consultada (URL + nombre del anexo/versión), para validación del contador.

## Qué NO hacer
- No migres a esquemas v4.4 (tarea T14) — mantén las URLs de versión actuales, solo corrige códigos/correspondencias.
- No toques la firma (`signer.js`) ni el cliente HTTP.

## Criterios de aceptación
- [ ] Tripletas código/namespace/raíz coherentes y con fuente citada.
- [ ] Tests de mapeo pasan y quedan como candado contra regresiones.
- [ ] Tabla final para el contador en el resumen.

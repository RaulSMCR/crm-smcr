# T13 — Captura completa de la factura del profesional (FIS-07 + CON-02) ⚠ validar reglas con el contador

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. Los profesionales (proveedores independientes) facturan sus honorarios al sitio con IVA 4%; el sitio necesita esas facturas electrónicas ACEPTADAS ante Hacienda para deducir el crédito fiscal. Flujo actual: `submitProfessionalInvoice` en `src/actions/professional-billing-actions.js` crea una `SUPPLIER_INVOICE` en DRAFT; el admin la valida y paga desde `/panel/admin/contabilidad`.

**Decisión de negocio:** IVA de las facturas de profesionales = 4% (servicios de salud). Montos que digita el profesional son IVA incluido; el sistema desglosa.

## Reglas duras
1. Migración Prisma con `prisma migrate dev --name supplier_invoice_fe_data`.
2. Reutiliza `splitTaxIncluded` de `src/lib/invoice-math.js` (creada en la tarea T09; si no existe aún, créala idéntica a su spec: `splitTaxIncluded(totalCents, ratePercent) → { baseCents, taxCents }`).
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
Hoy la factura del profesional guarda solo: referencia libre, monto único con `taxRate: 0`, y la URL del PDF metida en `notes`. Para defender el crédito fiscal ante Hacienda faltan: la **clave numérica de 50 dígitos** de la FE del proveedor, la cédula del emisor, el **XML firmado** (el comprobante legal es el XML, no el PDF), y el estado de **aceptación** (mensaje receptor). Sin esto, el 4% soportado no es deducible con seguridad.

## Pasos

1. Lee `professional-billing-actions.js`, el modelo `Invoice`, la página `/panel/profesional/contabilidad` y la ruta `src/app/api/upload/professional-invoice/`.
2. Schema — añade a `Invoice`:
   ```prisma
   attachmentUrl    String?   // PDF (migrar lo que hoy vive en notes)
   xmlUrl           String?   // XML firmado de la FE del proveedor
   supplierFeClave  String?   @db.VarChar(50)
   supplierIdNumber String?   @db.VarChar(32)
   acceptanceStatus String?   // PENDING | ACCEPTED | REJECTED (mensaje receptor)
   acceptanceAt     DateTime?
   ```
3. Formulario del profesional (panel contabilidad) — campos nuevos y validaciones:
   - **Clave numérica** (obligatoria): exactamente 50 dígitos; valida que los dígitos 4–15 (posición de la cédula del emisor en la clave, cédula a 12 dígitos con ceros a la izquierda) coincidan con la cédula (`User.identification`) del profesional — si `identification` está vacía, pedirle completarla primero en su perfil.
   - **XML de la factura** (obligatorio) además del PDF: acepta `.xml`, súbelo por la misma vía que el PDF (ruta de upload existente, extendida para XML).
   - **Monto** (IVA incluido): el sistema desglosa base + 4% con `splitTaxIncluded` y crea la línea con `taxRate: 4`, `taxAmount`, `lineSubtotal` correctos. Nada de `taxRate: 0`.
4. Vista del admin (`/panel/admin/contabilidad`, detalle de factura de proveedor): mostrar clave, cédula, enlaces a PDF y XML, y un control «Mensaje receptor» con botones **Aceptar** / **Rechazar** que setean `acceptanceStatus` + `acceptanceAt`. (La presentación del mensaje receptor ANTE HACIENDA sigue siendo manual por ahora; este estado registra la decisión. Deja un `// TODO T14/T16` donde iría el envío automático.)
5. Reporte de IVA (`/api/reports/tax`): el crédito fiscal (compras) debe contar SOLO facturas de proveedor con `acceptanceStatus: "ACCEPTED"`. Las no aceptadas se devuelven aparte en un campo `purchasesPendingAcceptance` (para que el módulo de cierre fiscal las liste).
6. Script `scripts/migrate-invoice-attachments.js`: mueve la URL que hoy está en `notes` hacia `attachmentUrl` (detecta patrón de URL en notes de SUPPLIER_INVOICE). Entregar sin ejecutar.
7. Tests: validación de clave (largo, cédula embebida), desglose 4%, y filtro de aceptación en el reporte.

## Qué NO hacer
- No implementes el envío real del mensaje receptor a Hacienda (necesita T14/v4.4).
- No bloquees facturas históricas que no tienen estos datos (solo las nuevas los exigen).
- No cambies el flujo de pago de la factura por el admin.

## Criterios de aceptación
- [ ] El profesional no puede presentar factura sin clave válida de 50 dígitos coherente con su cédula, ni sin XML.
- [ ] La factura queda con desglose 4% correcto y PDF/XML descargables por el admin.
- [ ] El admin registra aceptación/rechazo; solo lo aceptado suma crédito fiscal en el reporte.
- [ ] Script de migración de `notes → attachmentUrl` entregado.
- [ ] Tests pasan.

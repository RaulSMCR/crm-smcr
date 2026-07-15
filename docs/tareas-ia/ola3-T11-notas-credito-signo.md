# T11 — Notas de crédito con signo correcto en reportes (CON-04)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. Contabilidad: modelo `Invoice` con `invoiceType` (CUSTOMER_INVOICE, SUPPLIER_INVOICE, CUSTOMER_CREDIT_NOTE, SUPPLIER_CREDIT_NOTE). Reportes admin en `src/app/api/reports/` (tax, profit-loss, receivables, payables, invoices).

## Reglas duras
1. Convención elegida (no re-discutir): las notas de crédito se ALMACENAN en positivo (como hoy) y los REPORTES las agregan por separado y las restan. No cambies datos almacenados.
2. Alcance: solo `src/app/api/reports/*` y tests.
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
En `src/app/api/reports/tax/route.js` (líneas ~34 y ~44) las notas de crédito se incluyen en el MISMO agregado que las facturas con el mismo signo: `invoiceType: { in: ["CUSTOMER_INVOICE", "CUSTOMER_CREDIT_NOTE"] }`. Una devolución AUMENTA el IVA cobrado y los ingresos en vez de reducirlos. Revisar el mismo patrón en profit-loss, receivables, payables e invoices.

## Pasos

1. Lee los cinco reportes completos.
2. En `reports/tax`: separa los agregados — facturas de cliente, notas de crédito de cliente, facturas de proveedor, notas de crédito de proveedor — y calcula:
   - `ivaCobrado = IVA facturas cliente − IVA notas crédito cliente`
   - `ivaPagado = IVA facturas proveedor − IVA notas crédito proveedor`
   - El desglose `byTaxRate` también debe netear por tarifa (agrupa las NC por tarifa y resta).
   - Mantén la forma del JSON de respuesta (los consumidores del panel no deben romperse); añade campos nuevos (`creditNotes: {...}`) en vez de renombrar los existentes.
3. En `reports/profit-loss`: ingresos = facturas cliente − NC cliente; gastos = facturas proveedor − NC proveedor. Respeta el parámetro `basis` (cash/accrual) existente aplicándolo igual a las NC.
4. En `receivables`/`payables`: verifica cómo tratan las NC y corrige si también las suman; documenta lo encontrado.
5. Tests `tests/unit/reports-credit-notes.test.js` (mock de Prisma): período con 1 factura ₡104 000 (IVA ₡4 000) + 1 NC parcial ₡52 000 (IVA ₡2 000) → `ivaCobrado = 2 000`, ingresos neteados; caso sin NC → resultados idénticos a los actuales.

## Qué NO hacer
- No cambies el signo de datos almacenados ni la creación de notas de crédito (`/api/invoices/[id]/credit-note`).
- No toques la UI del panel de contabilidad (leerá los mismos campos).

## Criterios de aceptación
- [ ] Con una NC en el período, IVA e ingresos bajan; sin NC, nada cambia respecto a hoy.
- [ ] Desglose por tarifa neteado correctamente.
- [ ] Los cuatro reportes revisados quedan documentados en el resumen (OK / corregido).
- [ ] Tests pasan.

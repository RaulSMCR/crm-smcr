# T16 — Módulo de cierre fiscal (FIS-06) — requiere T09, T11 y T13 terminadas ⚠ casillas D-104 validadas por el contador

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. La S.A. emite facturas a pacientes con IVA 4% y recibe facturas de profesionales con IVA 4% (crédito fiscal solo si `acceptanceStatus: ACCEPTED`, ver reporte `/api/reports/tax` ya ajustado en T11/T13). Obligaciones periódicas: IVA mensual D-104 (presentar/pagar al 15 de cada mes en TRIBU-CR), renta anual D-101, pagos parciales trimestrales, y obligaciones societarias fijas. La presentación en TRIBU-CR es manual del contador; este módulo automatiza la RECOLECCIÓN y el recordatorio.

## Reglas duras
1. NO integres con TRIBU-CR ni servicios externos. Solo recolección, exportación CSV y checklist interno.
2. Migración Prisma con `prisma migrate dev --name fiscal_periods`.
3. Solo rol ADMIN accede a todo esto.
4. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Pasos

1. Lee `/api/reports/tax`, `/api/reports/profit-loss` y la página `/panel/admin/contabilidad`.
2. Schema:
   ```prisma
   model FiscalPeriod {
     id            String    @id @default(cuid())
     year          Int
     month         Int       // 1–12
     status        String    @default("OPEN") // OPEN | CLOSED | FILED
     ivaDebito     Decimal?  @db.Decimal(15, 2)
     ivaCredito    Decimal?  @db.Decimal(15, 2)
     ivaNeto       Decimal?  @db.Decimal(15, 2)
     withholdings  Decimal   @default(0) @db.Decimal(15, 2) // retenciones de adquirentes del período
     snapshot      Json?     // desglose completo congelado al cerrar
     filedAt       DateTime?
     filedReceipt  String?   // nº de comprobante de TRIBU-CR
     notes         String?   @db.Text
     createdAt     DateTime  @default(now())
     updatedAt     DateTime  @updatedAt
     @@unique([year, month])
   }
   ```
3. Página nueva `/panel/admin/contabilidad/cierre-fiscal`:
   - Selector de mes/año. Para el período: IVA débito por tarifa (ventas − NC), IVA crédito (facturas de proveedor ACEPTADAS − NC), neto a pagar o saldo a favor; campo editable de retenciones del período.
   - **Lista de alertas** del período: facturas de proveedor sin aceptar (no computan crédito — con enlace directo), facturas de cliente sin CABYS o con `feStatus` distinto de ACCEPTED, y pagos APPROVED sin factura asociada.
   - Botón **«Cerrar período»**: congela los números en `snapshot` y status CLOSED (recalcular exige reabrir, con confirmación). Botón **«Marcar como presentado»**: pide el número de comprobante → FILED.
   - Botón **«Exportar CSV»**: archivo con las filas mapeadas a las casillas de la D-104 (base y cuota por tarifa, compras con derecho a crédito, neto). Encabezados descriptivos; deja un comentario `// TODO validar casillas exactas con el contador` y usa nombres genéricos claros mientras tanto.
4. Sección «Anual (D-101 y pagos parciales)» en la misma página: acumulado del año fiscal (ingresos netos, gastos por honorarios ACEPTADOS, otros gastos registrados, utilidad estimada) reutilizando profit-loss; solo lectura + export CSV.
5. **Checklist de obligaciones**: lista fija renderizada (sin modelo nuevo): D-104 (día 15 de cada mes), pagos parciales de renta (junio/setiembre/diciembre), D-101 (según cierre fiscal), RTBF (abril), impuesto a personas jurídicas (enero), timbre educación y cultura (feb–mar). Cada ítem muestra si el período correspondiente está FILED (para D-104, usa FiscalPeriod) o un simple check manual persistido en `FiscalPeriod.notes`/campo JSON para las anuales. Resalta en rojo lo vencido y en ámbar lo que vence en ≤7 días.
6. Correo recordatorio: reutiliza QStash si ya hay patrón de programación en el proyecto (`src/lib/qstash.js`); si no, deja un endpoint `GET /api/reminders/fiscal` protegido por firma QStash que revisa vencimientos y envía correo al admin — y documenta en el resumen cómo programarlo (schedule mensual en el dashboard de QStash, día 8 de cada mes).
7. Tests: agregación del período (con NC y facturas no aceptadas excluidas del crédito), congelado del snapshot, y generación del CSV.

## Qué NO hacer
- No presentes nada automáticamente ante Hacienda.
- No dupliques la lógica de reportes: consume los endpoints/funciones de reports existentes.
- No hagas editable el snapshot de un período CLOSED/FILED sin reabrir.

## Criterios de aceptación
- [ ] El admin ve el IVA del mes con alertas de lo que distorsiona el número (no aceptadas, sin CABYS).
- [ ] Cerrar congela; presentar guarda comprobante; el checklist refleja el estado.
- [ ] CSV exportable con desglose por tarifa listo para transcribir a la D-104.
- [ ] Acumulado anual para renta visible y exportable.
- [ ] Tests pasan.

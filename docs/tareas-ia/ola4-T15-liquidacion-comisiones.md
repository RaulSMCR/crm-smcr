# T15 — Liquidación automática de comisiones a profesionales (PAY-02) — requiere T09 y T13 terminadas

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. Modelo de negocio: el sitio cobra el 100% al paciente (vía ONVO) y retiene una comisión (`ProfessionalProfile.commission`, entero en %, default 10); el resto se paga al profesional contra su factura electrónica (flujo de la tarea T13). Hoy `commission` y `Appointment.commissionFee` existen en el schema pero NINGÚN código los usa: todo es manual.

## Reglas duras
1. Migración Prisma con `prisma migrate dev --name settlements`.
2. Aritmética en céntimos enteros; usa `src/lib/invoice-math.js`.
3. Textos de UI en español de Costa Rica, con tildes.
4. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Objetivo
Que el sistema genere por período un «estado de cuenta» por profesional (bruto cobrado − comisión = neto a pagar), que el profesional lo confirme adjuntando su factura por EXACTAMENTE ese neto, y que el admin tenga una cola de pagos clara. Elimina la digitación libre de montos.

## Pasos

1. Lee: `src/app/api/payment/webhook/route.js`, `src/actions/professional-billing-actions.js`, `src/actions/payment-actions.js`, los paneles `/panel/profesional/contabilidad` y `/panel/admin/contabilidad`, y los modelos `PaymentTransaction`, `Appointment`, `ProfessionalProfile`, `Invoice`.
2. **Persistir la comisión al momento del pago**: en el webhook, cuando una transacción pasa a APPROVED, calcular y guardar `Appointment.commissionFee = amount × (commission del profesional al día de hoy) / 100` (redondeo a colón entero). Snapshot: si el % cambia después, las citas ya cobradas no cambian.
3. Schema — modelos nuevos:
   ```prisma
   model Settlement {
     id             String   @id @default(cuid())
     professionalId String
     periodStart    DateTime
     periodEnd      DateTime
     grossAmount    Decimal  @db.Decimal(12, 2)
     commissionPct  Int
     commissionAmt  Decimal  @db.Decimal(12, 2)
     netAmount      Decimal  @db.Decimal(12, 2)
     status         String   @default("OPEN") // OPEN | INVOICED | PAID | VOID
     invoiceId      String?  // SUPPLIER_INVOICE presentada contra este settlement
     createdAt      DateTime @default(now())
     updatedAt      DateTime @updatedAt
     items          SettlementItem[]
     @@unique([professionalId, periodStart, periodEnd])
   }
   model SettlementItem {
     id            String  @id @default(cuid())
     settlementId  String
     settlement    Settlement @relation(fields: [settlementId], references: [id], onDelete: Cascade)
     transactionId String  @unique // PaymentTransaction incluida (una sola vez en la vida)
     amount        Decimal @db.Decimal(10, 2)
     commissionAmt Decimal @db.Decimal(10, 2)
   }
   ```
4. Acción de admin «Generar liquidaciones del período» (`src/actions/settlement-actions.js`): recibe rango de fechas; por cada profesional toma las `PaymentTransaction` APPROVED con `paidAt` en el rango que NO estén ya en un `SettlementItem`; crea el Settlement con totales. Idempotente (el unique de transactionId lo garantiza). Botón en el panel admin de contabilidad.
5. Panel del profesional: sección «Liquidaciones»: lista con período, detalle de citas (fecha, paciente con iniciales, monto, comisión), neto, y estado. En un Settlement OPEN, el botón «Presentar factura» abre el formulario de T13 con el **monto precargado = netAmount y NO editable**; al presentar, `Settlement.status = INVOICED` y se enlaza `invoiceId`.
6. Panel del admin: cola «Por pagar»: settlements INVOICED con enlace a la factura (PDF/XML de T13); al marcar la factura como pagada (flujo existente `/api/invoices/[id]/pay`), el settlement pasa a PAID (hook en esa ruta o acción conjunta).
7. Correo (Resend) al profesional cuando su liquidación se genera: período, neto, enlace al panel.
8. Tests: cálculo de comisión con redondeos; idempotencia (regenerar el período no duplica ítems); transición de estados.

## Qué NO hacer
- No inventes cron jobs automáticos (el admin genera el período con un botón; automatizar con QStash es mejora futura).
- No incluyas transacciones REFUNDED/REJECTED.
- No permitas editar el monto de la factura vinculada a un settlement.

## Criterios de aceptación
- [ ] Pago aprobado → `commissionFee` guardado en la cita.
- [ ] Generar liquidaciones dos veces no duplica nada.
- [ ] El profesional solo puede facturar el neto exacto de su liquidación.
- [ ] Al pagar la factura, el settlement queda PAID y sale de la cola.
- [ ] Tests pasan.

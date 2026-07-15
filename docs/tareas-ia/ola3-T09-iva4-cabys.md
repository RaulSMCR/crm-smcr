# T09 — IVA 4% y CABYS en la facturación al paciente (FIS-04) ⚠ requiere CABYS del contador

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. Facturación: modelo `Invoice`/`InvoiceLine` con tabla `Tax` (name, rate, scope SALES|PURCHASES|BOTH) y `Service` (catálogo de servicios de salud que agenda el paciente). El webhook de pagos (`src/app/api/payment/webhook/route.js`, función `createAutoInvoice`) emite la factura automática al confirmarse el pago.

**Decisiones de negocio ya tomadas (no re-discutir):** IVA al paciente = 4% (servicios de salud, Ley 9635). Los precios aprobados de los servicios son **IVA incluido**: el paciente sigue pagando el mismo monto; la factura desglosa base + 4%.

## Reglas duras
1. Si cambias `prisma/schema.prisma`, migración con `prisma migrate dev --name service_tax_cabys`.
2. Aritmética de dinero: trabaja los desgloses en céntimos enteros y redondea una sola vez; los totales deben cuadrar exactamente (base + IVA = total pagado).
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
`createAutoInvoice` crea líneas con `taxRate: 0, taxAmount: 0` y sin código CABYS (obligatorio por línea ante Hacienda). Todas las ventas se registran sin IVA: contingencia fiscal y reportes de IVA en cero.

## Pasos

1. Lee `createAutoInvoice` en el webhook, el modelo `Service`, `Tax`, `InvoiceLine`, y `src/app/api/reports/tax/route.js` (consumidor del desglose).
2. Schema: añade a `Service`:
   ```prisma
   cabysCode String?
   taxId     String?
   tax       Tax?    @relation(fields: [taxId], references: [id], onDelete: SetNull)
   ```
   (con la relación inversa en `Tax`).
3. Seed: en `prisma/seed.js`, upsert idempotente de un `Tax` «IVA 4% — Servicios de salud» (`rate: 4`, `scope: BOTH`, `label: "IVA 4%"`, activo). No borres seeds existentes.
4. `createAutoInvoice`: desglose IVA-incluido a partir del monto pagado `total`:
   - `base = round(total / 1.04)` en céntimos; `iva = total - base` (así siempre cuadra).
   - Línea: `unitPrice = base`, `taxRate = 4`, `taxAmount = iva`, `lineSubtotal = base`, `lineTotal = total`, `cabysCode` desde `appointment.service.cabysCode`.
   - Cabecera: `subtotal = base`, `taxAmount = iva`, `total = total`.
   - Si el servicio no tiene `cabysCode` o `tax` configurados: emitir la factura igual PERO con `feStatus` sin tocar y una nota interna + correo de alerta al admin («Servicio sin CABYS/IVA configurado: revisar antes de enviar a Hacienda»). No bloquear el cobro.
5. Panel admin de servicios (`src/app/panel/admin/servicios/[id]/` y `nuevo/`): añade campos «Código CABYS» (texto, 13 dígitos, validar formato) e «Impuesto» (select de `Tax` activos con scope SALES/BOTH). Sigue el estilo de formulario existente.
6. Extrae el desglose a `src/lib/invoice-math.js`: `splitTaxIncluded(totalCents, ratePercent) → { baseCents, taxCents }`, y úsala en el webhook.
7. Tests `tests/unit/invoice-math.test.js`: ₡45 500 al 4% → base ₡43 750 + IVA ₡1 750; casos con céntimos que no dividen exacto (la suma SIEMPRE debe reconstruir el total); tarifa 13% de referencia.

## Qué NO hacer
- No cambies los precios que ve el paciente ni el monto cobrado.
- No toques la factura del profesional (`submitProfessionalInvoice`) — es la tarea T13.
- No toques los XML de FE (`src/lib/fe/`) — tareas T10/T14.

## Criterios de aceptación
- [ ] Un pago aprobado genera factura con línea al 4%, CABYS del servicio, y `base + IVA = total` exacto.
- [ ] `/api/reports/tax` muestra el desglose en la fila `taxRate: 4`.
- [ ] Servicio sin CABYS → factura emitida + alerta al admin (no se pierde el cobro).
- [ ] El admin puede configurar CABYS e impuesto por servicio desde el panel.
- [ ] Tests de `invoice-math` pasan.

# T05 — Webhook ONVO: validación de monto y pagos no conciliados (PAY-01)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. Pagos: enlaces de pago ONVO estáticos por asignación profesional-servicio (`ServiceAssignment.onvoPaymentLinkId`). El paciente paga en `checkout.onvopay.com` y ONVO notifica a `/api/payment/webhook` (firma HMAC ya verificada en `src/lib/onvo/webhook.js`).

## Reglas duras
1. NO agregues servicios ni dependencias nuevas.
2. Si cambias `prisma/schema.prisma`, migración con `npx prisma migrate dev --name unmatched_payments`.
3. La ruta debe seguir respondiendo 200 SIEMPRE (evita reintentos infinitos de ONVO); lo que cambia es qué hacemos internamente.
4. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
En `src/app/api/payment/webhook/route.js`, el evento se acredita a la transacción `LINK_SENT` **más reciente** del enlace, sin comparar monto, moneda ni pagador. Como el enlace es compartido, con dos pacientes pendientes del mismo profesional/servicio el pago del primero se acredita a la cita equivocada, y un pago por monto distinto marca la cita como pagada por completo.

## Pasos

1. Lee completos `src/app/api/payment/webhook/route.js`, `src/lib/onvo/webhook.js` y `src/actions/payment-actions.js`.
2. Nuevo modelo en `prisma/schema.prisma`:
   ```prisma
   model UnmatchedPayment {
     id             String   @id @default(cuid())
     onvoEventId    String   @unique
     onvoLinkId     String?
     amount         Decimal? @db.Decimal(10, 2)
     currency       String?
     customerEmail  String?
     reason         String   // NO_TRANSACTION | AMOUNT_MISMATCH | EMAIL_MISMATCH | MULTIPLE_CANDIDATES
     payload        Json
     resolvedAt     DateTime?
     resolvedTxId   String?
     createdAt      DateTime @default(now())
     @@index([createdAt])
   }
   ```
3. Extrae la lógica de emparejamiento a `src/lib/onvo/match-payment.js` como función pura y testeable: `matchTransaction(candidates, event)` recibe las transacciones activas del enlace y los datos del evento, y devuelve `{ match }` o `{ unmatchedReason }`:
   - El monto del evento debe ser IGUAL al `amount` de la transacción (ojo: verificar en qué unidad manda ONVO el monto — el payload de ejemplo sugiere céntimos: `45500` para ₡45 500; deja la conversión en UNA constante documentada y compárala con tolerancia 0).
   - La moneda debe coincidir (case-insensitive).
   - Si el evento trae `customer.email`, debe coincidir con el email del paciente de la transacción (normalizado a minúsculas). Si no lo trae, este criterio se omite.
   - Si tras filtrar queda exactamente 1 candidata → match. Si 0 → `NO_TRANSACTION`/`AMOUNT_MISMATCH`/`EMAIL_MISMATCH` según qué filtro vació la lista. Si >1 → `MULTIPLE_CANDIDATES` (no adivinar).
4. En el webhook: si no hay match, guardar `UnmatchedPayment` y enviar correo de alerta al admin (Resend, `ADMIN_ALERT_EMAIL` con fallback `EMAIL_FROM`) con los datos del evento y el motivo. NO tocar ninguna cita.
5. Firma inválida: además del log actual, registrar también un `UnmatchedPayment` con `reason: "INVALID_SIGNATURE"`? — NO: en ese caso solo enviar la alerta por correo al admin (el payload no es confiable, no lo persistas).
6. Tests en `tests/unit/match-payment.test.js`: match exacto; dos candidatas mismo monto → MULTIPLE_CANDIDATES; monto distinto → AMOUNT_MISMATCH; email distinto → EMAIL_MISMATCH; evento sin email → match por monto.
7. En tu resumen final, incluye una sección «Investigación plan A»: revisa https://docs.onvopay.com y reporta (solo reporte, sin implementar) si la API permite crear checkout/payment-intents por monto con `metadata` — sería la solución definitiva en una tarea futura.

## Qué NO hacer
- No cambies la idempotencia existente por `onvoEventId`.
- No modifiques la creación de facturas ni los correos de confirmación (solo se ejecutan cuando hay match APPROVED, como hoy).
- No agregues UI de administración de UnmatchedPayment (tarea futura); basta el correo de alerta.

## Criterios de aceptación
- [ ] Un evento con monto distinto al de la transacción NO marca nada como pagado y genera `UnmatchedPayment` + correo.
- [ ] Con dos transacciones activas del mismo enlace y mismo monto, el evento queda en `MULTIPLE_CANDIDATES` (no se adivina).
- [ ] El flujo feliz (una transacción, monto y email coinciden) funciona igual que antes: cita PAID, factura, correo.
- [ ] Tests nuevos pasan.

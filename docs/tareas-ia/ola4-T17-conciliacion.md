# T17 — Conciliación ONVO ↔ facturas ↔ banco (CON-01) — requiere T05 terminada

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. Pagos de pacientes vía ONVO Pay (`PaymentTransaction`, estados PENDING/LINK_SENT/APPROVED/REJECTED/REFUNDED); facturas en `Invoice`; eventos no conciliados en `UnmatchedPayment` (creado en T05). ONVO deposita al banco descontando su comisión de procesamiento.

## Reglas duras
1. NO integres APIs bancarias ni servicios nuevos. La conciliación bancaria es contra un monto que el admin digita (o un CSV que sube, si es simple).
2. Solo ADMIN.
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Objetivo
Una pantalla donde el administrador (una sola persona) detecte en minutos: pagos sin factura, facturas sin pago, eventos no conciliados pendientes, y si el depósito de ONVO del período cuadra con lo esperado.

## Pasos

1. Lee los modelos `PaymentTransaction`, `Invoice`, `UnmatchedPayment` y la página `/panel/admin/contabilidad`.
2. Página `/panel/admin/contabilidad/conciliacion` con selector de rango de fechas:
   - **Resumen del período**: nº y monto de pagos APPROVED; comisión ONVO estimada (porcentaje configurable en un campo, persistido en localStorage o en un setting simple — default editable, p. ej. 4.5%; comentario `// TODO confirmar % y si ONVO retiene impuestos a cuenta`); **depósito esperado** = bruto − comisión estimada; campo «Depósito recibido» donde el admin digita lo que llegó al banco; diferencia en verde/rojo.
   - **Pagos sin factura**: transacciones APPROVED del período sin `Invoice` asociada a su `appointmentId` (la factura automática pudo fallar) — enlace para crear factura manual.
   - **Facturas sin pago**: CUSTOMER_INVOICE en OPEN/PAID del período cuya cita no tiene transacción APPROVED.
   - **No conciliados**: `UnmatchedPayment` sin `resolvedAt`, con el payload legible y una acción «Vincular a transacción…» (select de transacciones candidatas del mismo enlace) que aplica el pago correctamente (reutiliza la lógica del webhook para marcar PAID + factura) y setea `resolvedAt`/`resolvedTxId`.
3. Endpoint(s) API bajo `/api/admin/reconciliation` con los tres listados y el resumen (verificación ADMIN como en las rutas de reports).
4. Tests de las consultas de detección (pago sin factura, factura sin pago) con mock de Prisma.

## Qué NO hacer
- No marques nada automáticamente como conciliado: toda resolución es acción explícita del admin.
- No dupliques la creación de facturas: reutiliza `createAutoInvoice`/lógica existente extraída si hace falta a `src/lib/`.

## Criterios de aceptación
- [ ] Un pago APPROVED cuya factura automática falló aparece en «Pagos sin factura».
- [ ] Un `UnmatchedPayment` puede resolverse desde la pantalla y desaparece de la lista, dejando la cita pagada y facturada.
- [ ] El resumen muestra depósito esperado vs recibido con diferencia visible.
- [ ] Tests pasan.

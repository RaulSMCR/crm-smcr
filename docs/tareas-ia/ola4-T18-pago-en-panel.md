# T18 — Pago dentro del panel del paciente (UX-01)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Tailwind, Prisma 5 + PostgreSQL. Tras completarse una cita, el sistema envía por correo el enlace de pago ONVO (`PaymentTransaction` con status LINK_SENT y `onvoPaymentLinkId`; URL = `https://checkout.onvopay.com/pay/{linkId}`). Si el correo se pierde, el paciente no tiene forma de pagar desde la web. Existe `getPaymentTransactions(appointmentId)` en `src/actions/payment-actions.js` (acceso: admin o paciente dueño) y páginas en `/panel/paciente/pago/`.

## Reglas duras
1. Textos en español de Costa Rica, con tildes, tono cálido.
2. No cambies el flujo del webhook ni la creación de transacciones.
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Pasos

1. Lee `/panel/paciente/page.js`, los componentes de `src/components/paciente/`, `payment-actions.js` y `buildPaymentLinkUrl` en `src/lib/onvo/client.js`.
2. En la lista de citas del panel del paciente, para cada cita muestra un **estado de pago** visible: «Pagada» (verde), «Pago pendiente» (ámbar, con monto), «—» si aún no aplica (cita futura sin cobro emitido).
   - Pendiente = existe `PaymentTransaction` en LINK_SENT/PENDING para la cita.
3. En citas con pago pendiente: botón **«Pagar ahora»** que abre el enlace ONVO de la transacción activa (`buildPaymentLinkUrl(tx.onvoPaymentLinkId)`) en pestaña nueva, y debajo un texto pequeño: «También te enviamos este enlace por correo».
4. En la cabecera del panel del paciente, si hay ≥1 pago pendiente, un aviso discreto pero visible: «Tenés N pago(s) pendiente(s)» con ancla a la lista.
5. Página `/panel/paciente/pago/resultado` (ya existe): verifica que tras volver del checkout muestre el estado real consultando la transacción (el webhook puede tardar unos segundos: si sigue LINK_SENT, mostrar «Estamos confirmando tu pago…» con botón «Actualizar estado», no un error).
6. Server action nueva o extensión mínima: `getPendingPaymentsForPatient()` (paciente de la sesión) que devuelva citas con transacción activa + monto + linkId. No expongas datos de otros pacientes (filtra por `session.userId`).

## Qué NO hacer
- No crees transacciones nuevas desde el panel (solo reutilizar la activa; si no existe, no mostrar botón).
- No muestres el `onvoEventId` ni payloads técnicos al paciente.
- No implementes pagos embebidos (iframe/SDK): el checkout sigue siendo la página de ONVO.

## Criterios de aceptación
- [ ] Paciente con cita completada y transacción LINK_SENT ve monto + «Pagar ahora» y el aviso en cabecera.
- [ ] Tras pagar (webhook procesado), el estado pasa a «Pagada» sin intervención.
- [ ] Un paciente no puede ver ni pagar transacciones de otro.
- [ ] La página de resultado maneja el caso «webhook aún no llegó» sin mostrar error.

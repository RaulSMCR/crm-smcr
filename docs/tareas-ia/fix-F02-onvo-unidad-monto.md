# F02 — Unidad del monto en eventos ONVO: hacerla configurable y diagnosticable — P0 antes de lanzar

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. El webhook de ONVO (`src/app/api/payment/webhook/route.js`) empareja eventos con transacciones vía `matchTransaction` (`src/lib/onvo/match-payment.js`), comparando el monto del evento contra `PaymentTransaction.amount` (guardado en colones).

## Reglas duras
1. Alcance: `src/lib/onvo/match-payment.js`, el webhook, `tests/unit/match-payment.test.js`, `.env.example`.
2. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
`ONVO_AMOUNT_DIVISOR = 100` asume que ONVO manda el monto en centésimos de colón. Pero el comentario histórico del webhook documentaba un payload de ejemplo con `"amount": 45500` para ₡45 500 (divisor 1). No hay confirmación contra un evento real. Si el divisor está mal, el 100% de los pagos caerá en `AMOUNT_MISMATCH`: nada se acreditará automáticamente y el admin recibirá una alerta por cada pago. Es un error silenciosamente catastrófico y trivial de prevenir.

## Pasos
1. Haz el divisor configurable: `ONVO_AMOUNT_DIVISOR` desde `process.env.ONVO_AMOUNT_DIVISOR` con default `100` (el actual). Documéntalo en `.env.example` con una nota: «Verificar con un pago real en modo test antes de lanzar: si los montos llegan en colones enteros, usar 1».
2. Diagnóstico automático en el mismatch: cuando `matchTransaction` devuelva `AMOUNT_MISMATCH`, calcula si el monto del evento HABRÍA coincidido con el divisor alternativo (1 ↔ 100). Si sí, incluye en el `reason` guardado en `UnmatchedPayment` y en el correo de alerta al admin el texto: `AMOUNT_MISMATCH (posible unidad incorrecta: con divisor X sí coincide — revisar ONVO_AMOUNT_DIVISOR)`. Así el primer pago real diagnostica el problema solo.
3. Tests: divisor por env respetado; mismatch con pista de divisor alternativo cuando aplica; sin pista cuando el monto no coincide con ninguno.
4. En tu resumen final, deja el procedimiento de verificación manual en 3 pasos (hacer un pago de prueba en modo test de ONVO, leer el `webhookPayload` guardado, confirmar la unidad).

## Qué NO hacer
- No cambies la lógica de emparejamiento (monto exacto, email, sin adivinar).
- No apliques el divisor alternativo automáticamente: solo diagnostica, nunca acredites con la unidad "adivinada".

## Criterios de aceptación
- [ ] El divisor se controla por env sin tocar código.
- [ ] Un mismatch por unidad equivocada se autodescribe en la alerta y en `UnmatchedPayment`.
- [ ] Tests en verde.

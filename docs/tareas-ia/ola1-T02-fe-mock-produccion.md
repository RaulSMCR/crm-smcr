# T02 — Bloquear facturación electrónica simulada en producción (FIS-01)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL (Supabase), auth propia con JWT (cookie `session`, lib `jose`), pagos ONVO Pay, correos Resend, facturación electrónica Hacienda CR en `src/lib/fe/`. Roles: USER (paciente), PROFESSIONAL, ADMIN.

## Reglas duras
1. NO introduzcas servicios ni dependencias nuevas. Solo lo presente en `package.json`.
2. Alcance quirúrgico: toca solo los archivos indicados.
3. Textos de UI y correos en español de Costa Rica, con tildes.
4. Al terminar: `npm run lint`, `npm test` y `npm run build` sin errores nuevos. Entrega lista de archivos cambiados + cómo probar.

## Problema
En `src/lib/fe/submit.js`, la función `submitInvoiceToFe()` tiene un modo mock: si `FE_API_URL` no está configurada, genera `feNumber` y `feClave` SIMULADOS, marca la factura como `feStatus: "ACCEPTED"` y envía al paciente un correo (`sendFeEmail`) afirmando que el documento "tiene validez tributaria conforme a la Ley 9069". Si producción arranca sin esa variable, se envían comprobantes falsos a pacientes reales. Riesgo legal serio ante Hacienda.

## Pasos

1. Lee completo `src/lib/fe/submit.js` y `src/app/api/payment/webhook/route.js` (que lo invoca) antes de tocar nada.
2. En `submitInvoiceToFe()`:
   - Si `process.env.NODE_ENV === "production"` (o `process.env.VERCEL_ENV === "production"`) y NO hay `FE_API_URL`: NO generar datos simulados. Dejar la factura con `feStatus: "PENDING"` y `feErrorMessage: "FE no configurada: falta FE_API_URL. Emitir manualmente o configurar la integración."`, registrar `console.error`, y enviar un correo de alerta al admin vía Resend (usa `process.env.ADMIN_ALERT_EMAIL`, con fallback a `process.env.EMAIL_FROM`) con el número de factura afectado. Retornar ese estado.
   - En modo mock (no-producción sin `FE_API_URL`): mantener la simulación para desarrollo, PERO (a) el `feErrorMessage` o `statusMessage` debe decir claramente `"SIMULADO — sin validez tributaria"`, y (b) NUNCA llamar a `sendFeEmail` en modo mock.
3. El correo real de FE (`sendFeEmail`) solo debe enviarse cuando la aceptación provino de la integración real.
4. Añade un test en `tests/unit/fe-submit.test.js` (vitest ya está configurado) que cubra: (a) producción sin FE_API_URL → PENDING y sin email; (b) mock en desarrollo → ACCEPTED simulado marcado y sin email al paciente. Mockea Prisma y Resend con `vi.mock`.

## Qué NO hacer
- No migres los esquemas XML ni toques `xml.js`/`config.js`/`signer.js` (eso es otra tarea).
- No cambies la lógica de creación de facturas del webhook.
- No elimines el modo mock (se usa en desarrollo).

## Criterios de aceptación
- [ ] Con `NODE_ENV=production` y sin `FE_API_URL`, una factura enviada a FE queda `PENDING` con mensaje claro, sin correo al paciente, con alerta al admin.
- [ ] En desarrollo el mock sigue funcionando, marcado como simulado y sin correo al paciente.
- [ ] Tests nuevos pasan; `npm test` completo pasa.

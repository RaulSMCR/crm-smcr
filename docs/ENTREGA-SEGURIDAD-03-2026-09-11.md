# Pagos: protección frente a duplicados y fallos de registro

11 de septiembre de 2026 · Tercera entrega de correcciones

**La corrección está implementada y validada en una rama aislada. Todavía no está publicada.** Su objetivo es evitar que el sistema registre un pago como aprobado, pero deje la cita o la factura a medio actualizar.

## Qué cambia para la operación

Antes, aprobar el pago, actualizar la cita y crear la factura ocurrían en operaciones separadas. Si la factura fallaba, el pago podía quedar aprobado; al reenviar la notificación, el sistema la consideraba ya atendida y no reparaba la factura faltante.

Ahora, los tres cambios y el consecutivo de la factura se confirman juntos. Si falla alguno, se revierten todos y el webhook responde con un error genérico que permite un reintento. Esto protege el registro dentro del CRM; **no deshace un cobro realizado por ONVO**.

También quedaron corregidos estos casos:

- Varias entregas simultáneas del mismo evento producen una sola acreditación y una sola factura.
- Un adelanto recibido después del saldo no rebaja una cita pagada a parcialmente pagada. Su correo tampoco anuncia un segundo cobro pendiente.
- Una aprobación posterior a un intento rechazado puede procesarse.
- La conciliación administrativa usa la misma operación financiera. Repetirla no duplica la factura; dos incidencias no pueden aplicarse a la misma transacción.
- La conciliación rechaza eventos no aprobados o incompatibles con el enlace, importe, moneda o correo, según las reglas de coincidencia existentes. Tampoco reactiva transacciones aprobadas, reembolsadas o expiradas.
- Si falla el cierre de una incidencia, se revierten también su acreditación y su factura.
- Las alertas fiscales se conservan y aclaran que el pago ya quedó registrado cuando corresponde.

Las llamadas a correo, Hacienda y medición se realizan después de confirmar los datos financieros. No se repiten dentro de los reintentos de la transacción.

## Cómo se comprobó

| Comprobación | Resultado |
| --- | --- |
| Pruebas específicas de pagos | 49 aprobadas, incluidas en el total de la suite |
| Pruebas con PostgreSQL local | 19 aprobadas: concurrencia, errores SQL, reversión y conciliación |
| Suite completa, `pnpm.cmd test --maxWorkers=2` | 905 aprobadas; 9 omitidas; ninguna fallida |
| `pnpm.cmd run lint` | Sin errores ni advertencias |
| `pnpm.cmd run build` | Correcto; 49 páginas estáticas generadas |

Las pruebas locales enviaron seis copias simultáneas de un mismo evento y provocaron errores SQL deliberados al crear una factura, actualizar una cita y cerrar una incidencia. Se verificó el estado persistido, no solo respuestas simuladas de Prisma.

Las nueve pruebas omitidas requieren servicios externos. La primera ejecución de la suite, sin limitar trabajadores, tuvo un timeout al importar una prueba de reprogramación; la ejecución con dos trabajadores pasó sin cambiar ese test ni ampliar su timeout. Los errores iniciales de lint de hubs quedaron resueltos al incorporar los cambios recientes de `main`.

**No existe un script independiente de typecheck.** El build conserva el aviso de Next.js sobre la futura sustitución de `middleware` por `proxy`.

## Límites que siguen pendientes

1. **Recuperación de envíos.** Si el proceso se interrumpe después de guardar el pago y antes de enviar un correo o una factura a Hacienda, esta entrega no garantiza su recuperación. Hace falta diseñar una cola persistente de tareas y reintentos. `after()` permite ejecutar trabajo después de responder, pero no sustituye esa cola.
2. **Identidad del cobro en ONVO.** La protección probada utiliza la identidad normalizada del evento y la transacción seleccionada. Falta verificar si ONVO emite varios tipos de evento para el mismo cobro y cómo se vinculan. Los enlaces compartidos y las coincidencias ambiguas siguen necesitando conciliación.
3. **Registros anteriores.** No se reparan automáticamente pagos aprobados sin factura. El panel existente compara facturas por cita y puede ocultar una falta cuando esa cita tiene más de un pago. Debe revisarse antes de usarlo como control contable completo.
4. **Casos operativos especiales.** Quedan por definir los pagos recibidos para citas canceladas o reembolsadas y las diferencias de pagador. Conservar el estado de reembolso de una cita no resuelve por sí solo un nuevo cobro asociado a ella. No se modificaron las reglas económicas de penalización o reembolso.
5. **Privacidad y proveedores.** Siguen pendientes la retención de eventos, la revisión de datos incluidos en correos y medición publicitaria, y las pruebas autorizadas de ONVO, Resend y Hacienda. No se realizaron cobros, devoluciones ni envíos reales.

## Dónde está y qué se preservó

Rama: `fix/audit-privacy-core-20260910`.

- Corrección y pruebas: commit `d84e35e`.
- Integración de tus cambios de hubs hasta `8e1a399`: commit `e8cd60b`.
- Núcleo financiero: `src/lib/onvo/process-payment.js` y `src/lib/onvo/payment-invoice.js`.
- Entradas del sistema: `src/app/api/payment/webhook/route.js` y `src/app/api/admin/reconciliation/route.js`.
- Alertas: `src/lib/onvo/payment-alert.js`.
- Evidencia reproducible: los tres archivos `onvo-*.test.js` de `tests/integration/` correspondientes a atomicidad, webhook y conciliación.

El esquema vigente se revisó. Esta corrección no añade modelos, migraciones, dependencias ni llamadas a modelos de IA. Se incorporó la migración de hubs que ya venía de `main`, sin ejecutarla.

La base temporal usa PostgreSQL 16 en `127.0.0.1:55439`. Se obtuvo solo la estructura del origen mediante una transacción cuyo modo de solo lectura se comprobó, y se crearon datos ficticios. No se copiaron pacientes ni se modificó la base real. Esta comprobación no valida las políticas RLS, permisos ni servicios externos de producción.

El siguiente paso técnico es preparar la recuperación persistente de tareas y el control de facturas por pago. Después corresponde revisar la integración y el despliegue con una compilación nueva: el artefacto local de pruebas no debe publicarse.

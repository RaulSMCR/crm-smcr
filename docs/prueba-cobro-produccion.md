# Prueba manual de adelanto y factura en producción

## Diagnóstico del 18 de septiembre de 2026

- El panel del paciente fallaba al renderizar `PatientProfileEditorCard`: faltaba importar `useToast`.
- Seguimiento: `MisProcesos` también llamaba a `useToast` sin importarlo y fallaba al existir un proceso. Se corrigió y se habilitó `no-undef` en el panel y los componentes del paciente. Una petición autenticada al dominio de producción pasó de HTTP 500 a HTTP 200, con perfil, citas y procesos renderizados, después del despliegue `dpl_GXnPtGjKoS8nrx3oadcMqMLHbosF`.
- Los logs de producción confirman ONVO live y `FE_AMBIENTE=02`. El control de coherencia bloquea la creación del enlace antes de llamar a ONVO.
- La cuenta examinada tiene dos citas pendientes, sin transacciones ni facturas. Solo la primera conserva `isFirstWithProfessional=true`. Crear otra cita no repite el adelanto inicial.
- En esa primera cita se confirmó un adelanto calculado de ₡1.000, CABYS de 13 dígitos, impuesto configurado del 4% y presencia de correo e identificación del paciente. Esto verifica presencia y formato básico, no aceptación por Hacienda.
- Vercel oculta los valores de variables `sensitive` al descargarlas. Que aparezcan vacías en `env pull` no significa que estén vacías en ejecución.
- Las credenciales fiscales locales corresponden al sandbox. El certificado local se pudo abrir y está vigente; eso no acredita su habilitación para producción.
- Por indicación del usuario se intentó autenticar contra Hacienda producción con esas credenciales locales, sin alterarlas: respondió HTTP 401, `invalid_grant`. No se obtuvo acceso para emitir. Este intento no verifica las credenciales protegidas de Vercel, cuyos valores no están disponibles mediante la descarga de variables.

## Seguimiento del correo de adelanto

- La cita recreada para el 21 de septiembre conserva tarifa de ₡2.000 y condición de primera cita. Al iniciar la recuperación seguía pendiente, sin transacciones ni facturas; el adelanto corresponde a ₡1.000.
- Se alinearon en Vercel Production `FE_AMBIENTE`, `FE_API_URL`, `FE_TOKEN_URL` y `FE_CLIENT_ID` con Hacienda producción. Se verificaron los valores descargados y se conservaron las variables de Preview y las credenciales protegidas existentes. No se activó `FISCAL_AMBIENTE_MIXTO`.
- El correo de pago ahora exige una referencia de aceptación de Resend. Una respuesta con error, sin identificador, sin configuración o sin destinatario ya no se considera un envío exitoso.
- El cobro se guarda como `PENDING` antes del envío y pasa a `LINK_SENT` después de la aceptación. Si el envío falla, el enlace queda disponible en el panel y el reintento reutiliza el mismo cobro. La actualización condicional no sustituye un `APPROVED` concurrente.
- La confirmación de reserva y el panel distinguen el envío pendiente. `LINK_SENT` significa aceptación del proveedor; no acredita por sí solo entrega en el buzón.
- Administración dispone de «Enviar adelanto 50%» para primeras citas pendientes o confirmadas y todavía impagas. La acción mantiene la reserva y comprueba autorización; rechaza adelantos de citas canceladas, ausentes, posteriores o con pago ya acreditado. También se corrigió el import de `useToast` necesario para renderizar esa pantalla administrativa.
- Validación de este seguimiento: lint, 1.209 pruebas aprobadas (37 omitidas) y build correctos. Las pruebas nuevas cubren rechazo de Resend, recuperación del mismo enlace, estados permitidos y concurrencia con la acreditación. No existe script `typecheck`.
- La copia de los 13 campos del emisor desde la configuración local a Vercel quedó pendiente de autorización específica solicitada por la revisión automática. No se copió ese contenido.
- Recuperación verificada en producción con el despliegue `dpl_5AHtzsrkCXZB3MwnW6TkzMQti6Vc`: el 18 de septiembre, a las 23:45 UTC, se generó un único adelanto `DEPOSIT_50` de ₡1.000 con enlace ONVO `live`. La acción administrativa devolvió éxito y el cobro quedó `LINK_SENT`.
- Resend confirmó `delivered` para el mensaje nuevo; se verificó que su HTML contiene el enlace de ese mismo cobro live. No se confundió con el correo de prueba anterior.
- El panel autenticado del paciente respondió HTTP 200 y contiene el enlace del cobro. La reserva sigue `PENDING`, el pago `UNPAID` y todavía no hay factura: el pago manual y la aceptación fiscal continúan pendientes.

## Configuración y verificaciones fiscales pendientes

En Vercel, proyecto `crm-smcr`, revisar las variables del entorno **Production**. No copiar claves al chat, a documentos ni a logs.

1. Confirmar con el titular del emisor las credenciales de API y llave criptográfica de Hacienda para producción. Comprobar autenticación y correspondencia entre certificado y emisor antes de emitir.
2. Configurar conjuntamente `FE_AMBIENTE`, `FE_API_URL`, `FE_TOKEN_URL`, `FE_CLIENT_ID`, `FE_USERNAME`, `FE_PASSWORD`, `FE_P12_BASE64` y `FE_P12_PIN` para producción. No basta cambiar `FE_AMBIENTE` a `01` dejando las demás en sandbox.
3. Completar las variables del emisor que no aparecen en el inventario de Production:

   - `FE_EMISOR_NOMBRE`, `FE_EMISOR_TIPO_ID`, `FE_EMISOR_IDENTIFICACION`, `FE_EMISOR_CORREO`.
   - `FE_EMISOR_TEL_CODIGO`, `FE_EMISOR_TEL_NUMERO`.
   - `FE_EMISOR_PROVINCIA`, `FE_EMISOR_CANTON`, `FE_EMISOR_DISTRITO`, `FE_EMISOR_OTRAS_SENAS`.
   - `FE_EMISOR_ACTIVIDAD`, `FE_EMISOR_SUCURSAL`, `FE_EMISOR_TERMINAL`.

4. Verificar CABYS e impuesto del servicio, datos del receptor y consecutivo fiscal antes de la primera emisión real. No reiniciar consecutivos existentes.
5. Mantener `ONVO_SECRET_KEY` live. El flujo usa la clave secreta; cambiar `ONVO_PUBLISHABLE_KEY` no cambia el entorno del enlace creado por el servidor.
6. Comprobar en ONVO live que el webhook apunta a `https://saludmentalcostarica.com/api/payment/webhook` y comparte el secreto configurado en `ONVO_WEBHOOK_SECRET`. No se ha verificado todavía su configuración live.
7. Redesplegar después de completar las variables y verificar el entorno efectivo. No habilitar `FISCAL_AMBIENTE_MIXTO` para saltar el bloqueo.

La [documentación de ONVO](https://docs.onvopay.com/) especifica que el entorno depende de la clave de autenticación. La [API oficial de Hacienda](https://www.hacienda.go.cr/docs/ComprobantesElectronicosAPI.html) distingue recibir un comprobante de aceptarlo: una respuesta de recepción no completa la prueba fiscal.

## Ejecución manual

1. Abrir `/panel/paciente` y confirmar que se muestran perfil y citas.
2. Elegir una sola cita para la prueba. Puede recuperarse el adelanto de la primera existente desde administración; cancelar duplicados requiere confirmar cuáles sobran. No borrar registros directamente en Supabase para reiniciar pagos.
3. Generar o reenviar el cobro **Adelanto 50%** de esa cita desde administración. Para una tarifa congelada de ₡2.000, debe cobrarse ₡1.000.
4. Comprobar recepción del correo, destinatario y enlace correspondiente al cobro live. La mera existencia de un registro `LINK_SENT` no demuestra que el correo se haya entregado.
5. Abrir el enlace y efectuar un solo pago manual. Ante una demora, verificar ONVO y el CRM antes de repetirlo.
6. Verificar `PaymentTransaction.status=APPROVED` y `Appointment.paymentStatus=PARTIALLY_PAID` para la misma cita.
7. Verificar una sola factura por ese pago, total ₡1.000 y `feStatus=ACCEPTED`, con clave y comprobante de Hacienda. `Invoice.status=PAID` por sí solo no prueba aceptación fiscal.
8. Comprobar entrega del correo del comprobante. Revisar pendientes o errores en `/panel/admin/contabilidad/conciliacion`.

## Webhook rechazado y receptor extranjero (18 de septiembre de 2026)

- El pago se completó en ONVO live, pero la transacción quedó en `LINK_SENT` sin
  `paidAt` ni `onvoEventId`, sin factura, sin trabajos de envío y con el
  consecutivo intacto en 188. La factura se crea dentro de `processOnvoPayment`,
  que solo corre desde el webhook: la parte fiscal no llegó a iniciarse.
- Los logs de producción muestran cuatro POST a `/api/payment/webhook`
  rechazados con 401 `AUTH_REJECTED`. ONVO sí envía; el secreto configurado no
  coincide con el que llega. No hay filas en `UnmatchedPayment`, lo que descarta
  que el aviso entrara y fallara al emparejar.
- El endpoint responde 401 ante un secreto incorrecto y 200 ante el valor
  cargado en Vercel, así que la ruta y la comparación funcionan. La discrepancia
  está entre ese valor y el que ONVO emite.
- El rechazo ahora registra `reason` (`SECRET_MISMATCH` o `SECRET_HEADER_ABSENT`)
  y los **nombres** de las cabeceras recibidas, nunca sus valores. Con el próximo
  aviso real eso distingue un secreto compartido de una firma, que es la duda de
  fondo sobre el esquema de autenticación del webhook.
- El dashboard de ONVO no ofrece reenviar un evento. `tmp/reenviar-evento-onvo.mjs`
  publica el payload original contra el endpoint y, antes de enviarlo, comprueba
  con los módulos del servidor que vaya a emparejar. El endpoint es idempotente
  por `onvoEventId`.
- Al preparar esa emisión se detectó que el receptor habría salido con
  `TipoIdentificacion=04` (NITE) sobre una identificación de relleno. La lectura
  del XSD 4.4 estableció que `Receptor` y su `Identificacion` son obligatorios y
  que no existe campo de país fuera de `Telefono/CodigoPais`. Ver
  [factura-electronica-receptor.md](factura-electronica-receptor.md).
- Queda pendiente guardar el XSD en `docs/esquemas/` y validar contra él en las
  pruebas. Hacienda responde 403 a la descarga automatizada.

## Validación realizada

`pnpm run lint`, `pnpm test` (1.190 pruebas aprobadas; 37 omitidas) y `pnpm run build` pasaron. Se reprodujo el `ReferenceError` del perfil antes del cambio y se renderizó correctamente después. El build necesitó ejecutarse fuera del sandbox por un fallo TLS de Prisma al leer datos para páginas estáticas. No existe script `typecheck`.

No se modificaron schema, migraciones, dependencias ni integraciones con modelos. No se completó todavía el pago real ni la aceptación fiscal. Los logs también muestran Google Calendar con `invalid_grant` y fallos de QStash; son incidencias adicionales, pendientes de corrección.

# Primera entrega de seguridad

Fecha: 10 de septiembre de 2026.

Las tres correcciones acordadas están implementadas y tienen 22 pruebas específicas aprobadas. La entrega está preparada para revisión local. Todavía no está publicada ni reúne todas las condiciones para desplegar.

## Qué cambia para el proyecto

1. **Contenido más seguro.** El componente que entrega datos estructurados a los buscadores escapa los caracteres que podrían cerrar su etiqueta HTML. Un nombre o texto editable conserva su significado como JSON y no puede introducir otra etiqueta a través de este componente.
2. **Menos datos privados en el navegador.** El editor administrativo del blog consulta únicamente los campos que necesita y el nombre del autor. Deja de cargar y entregar las cuentas y los perfiles completos del profesional. Conserva el control de acceso de administrador.
3. **Avisos de pago autenticados y registros más discretos.** El webhook comprueba el secreto compartido antes de leer el cuerpo de la solicitud. Las solicitudes no autenticadas no consultan la base de datos ni envían alertas. Los logs propios de esta ruta contienen acciones, referencias y códigos permitidos, sin cuerpos completos, cabeceras, correos del pagador ni mensajes completos de error. Las alertas administrativas omiten el correo del pagador y escapan los valores insertados en su HTML.

## Ubicación y alcance

- Rama: `fix/audit-privacy-core-20260910`.
- Versión de partida: `83d71a1e322634e035901bf76b90bdb6b5e1abaf`.
- Copia de trabajo: `C:\Users\usuario\AppData\Local\Temp\smcr-audit-core-20260910`.
- Cambios: cinco archivos de aplicación, tres archivos de pruebas y este informe.

La carpeta principal recibió cambios de otro trabajo durante esta entrega. Al comprobarla, su HEAD era `f73cd54bcaddbc55987417cf2231eee0c64ac547`, con modificaciones adicionales en preparación. Esta entrega no los incorpora ni los modifica. Antes de integrar habrá que comprobar de nuevo la versión vigente y ejecutar las verificaciones sobre el resultado combinado.

No se modificaron el esquema Prisma, las migraciones, los lockfiles ni las dependencias. No se añadieron llamadas, SDKs ni automatizaciones de modelos de IA. Las pruebas de esta entrega utilizaron datos ficticios y servicios simulados; no se ejecutaron cobros, envíos de correo ni escrituras en la base de datos real. Calendario, OAuth y reglas de comisión quedan fuera del diff.

## Evidencia en el código

| Corrección | Archivos |
| --- | --- |
| Serialización segura de JSON-LD | `src/components/JsonLd.js` |
| Consulta limitada para el editor | `src/lib/admin-post-editor.js`; `src/app/panel/admin/blog/[id]/page.js` |
| Autenticación y privacidad del webhook | `src/app/api/payment/webhook/route.js`; `src/lib/onvo/observability.js` |
| Pruebas | `tests/unit/json-ld-security.test.js`; `tests/unit/admin-post-editor-security.test.js`; `tests/integration/onvo-webhook-security.test.js` |

El contrato de la consulta se contrastó con `prisma/schema.prisma`, el cliente Prisma generado y los campos consumidos por `AdminPostEditor`. Se conserva el resultado nulo que permite responder 404 cuando un artículo no existe.

## Resultado de las verificaciones

| Verificación | Resultado |
| --- | --- |
| Pruebas específicas de las tres correcciones | 22 aprobadas |
| ESLint sobre los ocho archivos JavaScript de la entrega | Sin errores ni advertencias |
| Suite completa de la entrega | 852 aprobadas, 4 fallidas, 9 omitidas; 865 en total |
| Suite de la versión original, extraída con `git archive` | 830 aprobadas, las mismas 4 fallidas, 9 omitidas; 843 en total |
| Lint completo de la entrega y de la versión original | Los mismos 5 errores y 5 advertencias |
| Build | Compilación de código aprobada; build incompleto por configuración ausente |
| Typecheck independiente | No existe un script disponible |
| `git diff --check` | Sin errores de espacios |

La comparación completa de pruebas se ejecutó con `pnpm.cmd test --maxWorkers=2` para limitar la carga simultánea. Las integraciones de ONVO y facturación electrónica que requieren servicios externos permanecieron desactivadas. Las 22 pruebas nuevas comprueban la frontera HTML/JSON, la selección de datos y el comportamiento de la ruta de pago con dependencias simuladas; no sustituyen una prueba del proveedor y la base de datos de ensayo.

Los cuatro fallos previos están en:

- `tests/unit/appointment-recurrence-timezone.test.js:19`: el primer día esperado no existe y falla el acceso a `slots`.
- `tests/unit/booking-conflicts.test.js:98`, `:114` y `:125`: el doble de Prisma de esas pruebas no proporciona `scheduleBlock.findMany`, que utiliza la implementación vigente.

Los cinco errores previos de lint corresponden a enlaces internos escritos con `<a>` en las páginas administrativas de cierre fiscal, conciliación y adquisición. Las cinco advertencias restantes corresponden a las configuraciones PostCSS/Tailwind, la imagen de Open Graph y una dependencia de efecto en `PostMarketingTracker`.

El primer intento de build falló al descargar fuentes de Google por la restricción de red. El segundo, con acceso a esas fuentes, compiló el código y se detuvo al recopilar los datos de `/api/admin/reconciliation`: `src/lib/fe/submit.js:16` construye un cliente de Resend que requiere configuración. La copia de prueba no contiene las credenciales de producción. No se puede afirmar que el build completo ni el despliegue estén verificados.

## Comportamiento HTTP del webhook

| Caso | Respuesta |
| --- | --- |
| Secreto compartido ausente en la configuración | 503 y cuerpo genérico |
| Secreto recibido ausente o incorrecto | 401, antes de leer el cuerpo |
| JSON o estructura básica inválidos, con autenticación válida | 400 |
| Excepción que alcanza el manejador principal | 500 y cuerpo genérico |
| Evento atendido o descartado por las comprobaciones existentes | 200 |

Las respuestas 401, 400 y 503 sustituyen respuestas 200 del código anterior. Antes de publicar deben comprobarse en el entorno de ensayo de ONVO, junto con su configuración efectiva de reintentos. Esta entrega no implementa una nueva garantía de idempotencia ni de recuperación de fallos parciales.

## Qué permanece pendiente

**Para completar la validación técnica:** resolver los cuatro fallos previos y los errores de lint; completar el build con configuración de prueba adecuada; revisar el resultado integrado con el trabajo actual de la carpeta principal. Las credenciales deben configurarse en el entorno correspondiente, no enviarse por chat ni añadirse al repositorio.

**Para comprobar la experiencia real:** abrir el editor administrativo con una cuenta de prueba y revisar su respuesta de datos en el navegador; verificar un artículo que usa JSON-LD; probar un pago autorizado, uno fallido y un reenvío en la integración de ensayo; comprobar la recepción de las alertas y sus logs sin datos reales de pacientes.

**Para una siguiente corrección de pagos:** los eventos autenticados completos siguen almacenándose en `PaymentTransaction.webhookPayload` y `UnmatchedPayment.payload` para conciliación. Se necesita acordar su minimización, acceso y retención. La protección frente a concurrencia y la recuperación después de un procesamiento parcial requieren revisión adicional. La función que guarda pagos no conciliados todavía captura sus propios errores, por lo que un fallo de persistencia puede terminar en una respuesta 200; este comportamiento previo no se corrigió aquí.

**Para la privacidad del conjunto:** este cambio reduce los logs emitidos directamente por la ruta y sus alertas administrativas. No certifica los logs de todas las dependencias ni reduce todavía el contenido de los correos de confirmación al paciente o de seguros. La separación de datos de atención y medición publicitaria necesita su propia revisión antes de activar campañas.

El siguiente paso es integrar y validar esta entrega junto con la versión vigente, resolver los bloqueos de verificación y realizar las pruebas externas de ensayo. La publicación requiere esa evidencia y la aprobación final del propietario.

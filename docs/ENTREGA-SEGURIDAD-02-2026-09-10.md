# Segunda entrega: cierre de bloqueos técnicos

Fecha: 10 de septiembre de 2026.

**Los bloqueos de pruebas, lint y build quedaron resueltos.** La versión corregida también pasó comprobaciones HTTP contra la aplicación compilada y una base PostgreSQL local. Los cambios están guardados en la rama `fix/audit-privacy-core-20260910`; todavía no están publicados.

## Qué quedó resuelto

- **Pruebas de calendario:** se corrigieron las fechas ambiguas de los datos de prueba y se actualizaron los dobles de Prisma y Google Calendar. Ahora se comprueba que citas, bloqueos manuales y eventos externos impidan reservar un horario ocupado. Se conserva la exclusión de eventos propios al reprogramar. El código de calendario y OAuth no se modificó.
- **Lint:** se corrigieron cinco enlaces de navegación administrativa, las exportaciones de configuración, la dependencia de título del seguimiento de artículos y el texto alternativo del logo en Open Graph. El elemento `img` del generador PNG se conserva con una excepción local justificada: ese renderizador necesita el elemento nativo. No se desactivaron reglas globales.
- **Build y Resend:** facturación usa el cliente de correo compartido. Cargar el módulo sin credenciales de correo ya no detiene la compilación; los envíos siguen requiriendo configuración.
- **Build y QStash:** los receptores de recordatorios y seguimiento verifican su configuración al recibir solicitudes. Sin configuración responden 503. Las firmas ausentes, incorrectas o correspondientes a un cuerpo alterado no ejecutan el manejador. El SDK conserva la comprobación de las claves actual y siguiente. El cliente que programa los mensajes se crea después de comprobar que hay un token disponible.
- **Persistencia de pagos no conciliados:** si falla el guardado de la incidencia, el webhook devuelve un error 500 genérico. Ya no responde 200 como si hubiera conservado la evidencia. Esta corrección permite que el proveedor trate la entrega como fallida; su política efectiva de reintentos debe comprobarse en el entorno de ensayo.

## Evidencia de validación

| Comprobación | Resultado |
| --- | --- |
| `pnpm.cmd run lint` | Aprobado: cero errores y cero advertencias |
| `pnpm.cmd test --maxWorkers=2` | 868 aprobadas; 9 omitidas; ninguna fallida |
| Calendario y conflictos con `TZ=Pacific/Auckland` | 19 pruebas aprobadas |
| `pnpm.cmd run build` | Aprobado; 42 páginas estáticas generadas |
| Aplicación compilada, con `next start` | 13 comprobaciones HTTP aprobadas |
| `git diff --check` | Aprobado |

Las nueve pruebas omitidas pertenecen a integraciones que requieren servicios externos. **No existe un script independiente de typecheck.** El build aún muestra el aviso de Next.js sobre la futura sustitución de la convención `middleware` por `proxy`; no impide compilar y no se modificó el control de acceso para silenciarlo.

Las comprobaciones HTTP verificaron:

1. Redirección del visitante sin sesión y rechazo de los roles USER y PROFESSIONAL al editor administrativo.
2. Acceso del administrador al editor y respuesta 404 para un artículo inexistente.
3. Ausencia en el HTML y los datos serializados del editor de los marcadores privados de contraseña, token de Google y cuenta bancaria del autor.
4. Respuestas 200 en artículo, servicio y perfil profesional de prueba.
5. JSON-LD válido al renderizar un nombre que contiene un intento de cerrar `script`, sin introducir la etiqueta ejecutable.
6. Rechazo del webhook sin autenticación y con JSON inválido, sin guardar incidencias.
7. Un evento autenticado sin transacción coincidente crea una incidencia local; reenviarlo no crea otra.
8. Ambos receptores de QStash responden 503 cuando faltan sus claves.

Estas comprobaciones revisaron las respuestas del servidor. No equivalen a una revisión visual ni a una prueba de todos los controles interactivos en un navegador.

## Cómo se protegieron los datos

Se creó una base temporal PostgreSQL 16, limitada a `127.0.0.1:55439`, con tablas, tipos, índices y relaciones obtenidos de los catálogos del esquema existente. La lectura del origen se hizo dentro de una transacción cuyo modo `READ ONLY` se comprobó expresamente. No se copiaron filas, permisos, políticas RLS, funciones ni disparadores de producción. La copia recibió únicamente usuarios, artículos y otros registros ficticios para las pruebas.

No se modificó la base real ni se crearon o ejecutaron migraciones del proyecto. No se añadieron dependencias ni llamadas a modelos de IA. El build y las comprobaciones HTTP no utilizaron credenciales de producción para correo, pagos o recordatorios. Los procesos locales de prueba se detuvieron al terminar.

La carpeta principal estaba en `290dd4f`. Ese trabajo se incorporó a la rama aislada mediante el commit local `b86f2ff`, antes de las verificaciones. Se preservaron los cambios de comisiones y liquidaciones.

## Qué sigue pendiente antes de publicar

1. **Entorno de despliegue:** verificar la configuración efectiva de Resend, ONVO y QStash en el entorno que se vaya a publicar. Que el build funcione sin esas credenciales no implica que los servicios funcionen sin ellas.
2. **Pruebas de proveedores:** comprobar entregas, fallos y reenvíos de ONVO y QStash, recepción de correos y el recorrido autorizado de pago y factura en sus entornos de ensayo. No se realizaron cobros ni envíos reales en esta entrega.
3. **Pagos concurrentes o parcialmente procesados:** el reenvío secuencial comprobado no demuestra protección ante dos entregas simultáneas ni recuperación automática de todos los efectos posteriores a un cobro. Esa revisión sigue pendiente.
4. **Privacidad y operación:** sigue pendiente acordar minimización y retención de los eventos autenticados guardados, revisar los correos clínicos/administrativos y completar la separación entre atención y medición publicitaria.

La integración en `main` y la publicación aún requieren revisión del diff y aprobación del propietario. El despliegue debe generar un build nuevo con su configuración correspondiente: el artefacto local de esta prueba contiene registros ficticios y no debe publicarse.

## Archivos principales para revisión

- `src/lib/fe/submit.js`: reutilización del cliente de Resend.
- `src/lib/qstash-webhook.js`, `src/lib/qstash.js` y las rutas `api/reminders/send` y `api/reenganche/send`: configuración diferida y verificación de firmas.
- `src/app/api/payment/webhook/route.js`: propagación segura del fallo al guardar una incidencia.
- `tests/unit/appointment-recurrence-timezone.test.js` y `tests/unit/booking-conflicts.test.js`: pruebas actualizadas de fechas y ocupación.
- `tests/unit/fe-import-without-mail.test.js`, `tests/unit/qstash-webhook.test.js` y `tests/integration/onvo-webhook-security.test.js`: pruebas de las correcciones de servicios externos.

El diff de esta segunda entrega se puede revisar contra `b86f2ff`. El conjunto de ambas entregas se puede revisar contra `290dd4f`.

# Piloto PALIG — Raúl Olmedo

Entrada compartida: `/panel/palig`, enlazada desde Contabilidad del administrador y desde el panel de Raúl. Solo admite al administrador responsable de facturación y a la cuenta activa y aprobada del profesional `raul-olmedo`.

## Operación

1. El paciente debe estar registrado, tener PALIG como aseguradora y una cita con Raúl. El servicio necesita CABYS, impuesto y datos fiscales del receptor utilizables, igual que los pagos manuales existentes.
2. Descargar la plantilla editable desde el piloto. Incluye los datos disponibles del perfil. Raúl completa y revisa el seguro y la información clínica, dejando firmas y fechas de atención pendientes, y la guarda una vez por paciente. Al subirla se validan formato editable y campos clínicos mínimos. Las actualizaciones crean archivos nuevos.
3. Seleccionar la cita de hoy, revisar el monto con IVA incluido y subir el comprobante SINPE (PDF, JPG o PNG, máximo 4 MB). Confirmar que atención y pago ocurrieron hoy. El profesional y el medio de pago ya están seleccionados.
4. Se marca la cita efectuada y pagada, se crea la factura en el flujo fiscal existente y se genera el formulario PALIG con la misma fecha del pago. El PDF y XML de la factura quedan disponibles cuando Hacienda la acepta. El formulario queda listo para revisar y firmar; la entrega de la versión firmada usa la sección existente de Seguros médicos en Citas.

El día es el de **Costa Rica**. Solo se admiten citas ya iniciadas del día, sin pagos anteriores ni otro trámite de seguro. No se cambian fechas reales de citas, no se retrofechan facturas y no se generan anticipos. El comprobante se conserva como respaldo: el operador verifica fecha, monto y recepción; no hay OCR ni verificación bancaria automática. Para pagos atrasados se conserva el flujo manual existente, fuera de este piloto.

PALIG no tiene un campo de monto en este formulario: el monto se incluye en la factura adjunta. No se inventan diagnósticos ni se insertan firmas. Las fechas junto a las firmas corresponden a los firmantes.

## Integridad y almacenamiento

Se reutilizan pagos manuales, numeración fiscal, desglose de IVA, colas de entrega y reintentos de Hacienda. Pago, estado de cita, factura y vínculo `InsuranceClaim` se guardan en una transacción serializable. Las fechas de pago y factura comparten el instante de registro; la fecha de atención del PDF comparte su día local. La plantilla y los nombres se comprueban de nuevo dentro de la transacción para detectar cambios concurrentes.

Antes del pago se guardan copia de la plantilla original, PDF generado y comprobante en rutas únicas privadas dentro de `insurance-signed-forms/{claimId}/palig/`. Nunca se sobrescriben. Un reenvío de la misma cita recupera sus documentos; actualizar el estado fiscal no genera otro cobro. Un fallo antes de la transacción puede dejar archivos privados sin vínculo, pero no un pago incompleto. No se borran automáticamente tras errores de resultado incierto, porque la transacción podría haber confirmado; cualquier limpieza debe contrastar los vínculos existentes.

Las descargas del piloto usan URLs firmadas de 120 segundos. Los respaldos y borradores no se entregan al paciente mediante la ruta genérica de archivos; el formulario firmado conserva su ruta y entrega habitual.

## Activación pendiente

La migración `20261020210000_palig_invoice_outputs` está **preparada, no aplicada**. Añade cuatro columnas opcionales a `InsuranceClaim`: `invoiceId` (único y FK), `templateSnapshotUrl`, `generatedFormUrl`, `paymentProofUrl`. No modifica datos existentes. Aplicarla a la base real requiere autorización separada, antes del despliegue del código que consulta estos campos. Generar Prisma Client forma parte del build/instalación.

Los buckets existentes `insurance-templates` y `insurance-signed-forms` deben permanecer privados; el segundo debe admitir los tres MIME del comprobante y archivos de hasta 4 MB. No se cambió la configuración real de Supabase. Se incluye la plantilla pública en el trazado de archivos de la función de Vercel.

Se añadió únicamente `pdf-lib@1.17.1` y sus dependencias transitivas al lockfile existente, con autorización. No se migró el gestor de paquetes ni se añadieron llamadas a modelos.

## Fuente y verificación

Formulario: [Solicitud de reclamo PALIG Costa Rica 2023](https://assets.ctfassets.net/em61esqt6ro0/5EClmVfvAcFljU8YIHPnZx/988e5b475a17b133c75c7d619c4932b1/Costa_Rica_-_Formularios_-_Solicitud_de_Reclamo_-_2023.pdf), copia en `public/forms/palig-cr-reclamo-2023.pdf`. SHA-256: `57e157fdb865ab1b58105611029e06659efc1cac5f780d25e07625719e98b3d8`. Mapa de campos en `src/lib/palig-fields.js`; otro formulario requiere revisar el mapa y su disposición.

Las pruebas usan datos ficticios y mocks de Prisma, Storage y Hacienda: fechas, permisos, archivos, campos del PDF real, transacción, reintentos y errores. La revisión visual usa PDFs sintéticos renderizados con PyMuPDF. No se emitieron facturas ni se escribieron datos reales. Quedan pendientes la prueba operativa en el entorno de pruebas autorizado y la comprobación de aceptación del expediente por PALIG. El repositorio no dispone de script `typecheck`.

Validación local del cambio: `pnpm run lint`, `pnpm test` (1.488 correctas, 37 omitidas por configuración) y `pnpm run build` completados; `prisma validate` correcto. El build necesitó acceso de lectura fuera del sandbox para recopilar páginas públicas existentes de Supabase. Persisten los avisos previos de Next sobre `middleware` y la antigüedad de Browserslist. No se ejecutaron pruebas que requieran mutar servicios reales.

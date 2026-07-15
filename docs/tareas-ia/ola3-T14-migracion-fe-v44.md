# T14 — Migración de esquemas FE a v4.4 (FIS-02) ⚠ DOS FASES: la fase 1 se valida con el contador antes de codificar

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript). Facturación electrónica Hacienda CR propia en `src/lib/fe/`: `xml.js` construye el XML (xmlbuilder2), `signer.js` firma XAdES-BES (node-forge), `client.js` obtiene token y envía a la API de recepción, `config.js` constantes, `submit.js` orquesta. Hoy usa los esquemas **v4.3** (`cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.3/...`), obsoletos: la versión **4.4** es obligatoria desde el 1 de setiembre de 2025 — los documentos v4.3 son rechazados.

## Reglas duras
1. **Fase 1 (esta sesión): SOLO investigación y documento de mapeo. NO tocar código.** La fase 2 se ejecuta en otra sesión cuando el documento esté validado por el contador.
2. Fuentes: exclusivamente material oficial de Hacienda (resolución de comprobantes electrónicos vigente y sus anexos, estructuras XSD v4.4 en el CDN oficial, notas técnicas de la DGT). Cita URL y versión de cada afirmación. Si no puedes acceder a una fuente, márcalo como «no verificado» — no rellenes de memoria.
3. Prerrequisitos ya hechos que debes asumir: catálogo de tipos de documento corregido (tarea T10) y emisor por variables de entorno (T12).

## Fase 1 — Entregable: `docs/tareas-ia/T14-mapeo-v44.md`

El documento debe contener:

1. **Tabla de cambios v4.3 → v4.4** relevantes para los documentos que emite el CRM (Factura 01, Nota de crédito 03, Factura de compra 08, Tiquete 04): campos nuevos obligatorios y opcionales, campos renombrados/eliminados, cambios en `Clave`/consecutivo si los hay, cambios en los catálogos (medios de pago, unidades, tipos de identificación), y el nuevo comprobante **Recibo Electrónico de Pago** (cuándo sería obligatorio para este negocio, si aplica).
2. **Impacto archivo por archivo**: para `xml.js`, `config.js`, `client.js`, `signer.js`, `submit.js` — qué funciones cambian y cómo.
3. **Datos faltantes en el modelo**: qué campos exige v4.4 que hoy no existen en `Invoice`/`InvoiceLine`/`User` (p. ej., si el receptor requiere más datos de identificación, actividad económica del receptor, proveedor de sistemas, etc.), con la migración Prisma propuesta.
4. **Endpoints y autenticación**: URLs de recepción v4.4 (staging y producción), cambios en el token IDP si los hay.
5. **Preguntas para el contador** (lista numerada, cerrada, respondible con sí/no o un dato): tipo de cambio de moneda, condiciones de venta aplicables, si emitimos tiquete o factura a consumidores finales sin cédula, etc.
6. **Plan de la fase 2** en pasos de menos de una hora cada uno, con los tests golden-file propuestos (XML esperado vs generado para 3 casos: factura 4% simple, nota de crédito, factura de compra).

## Fase 2 — (otra sesión, con el mapeo validado)
Implementar según el documento: actualizar namespaces y builder, añadir campos/migración, actualizar `client.js`, tests golden-file, y prueba real contra el ambiente de **staging** de Hacienda (ambiente 02) con el certificado de pruebas. Nunca contra producción.

## Qué NO hacer (fase 1)
- No modificar ningún archivo fuera de `docs/tareas-ia/`.
- No proponer contratar un proveedor de FE (decisión de negocio ya tomada: evaluar al lanzar; mientras tanto, integración propia).

## Criterios de aceptación (fase 1)
- [ ] `T14-mapeo-v44.md` existe con las 6 secciones, cada afirmación con fuente oficial citada o marcada «no verificado».
- [ ] Las preguntas al contador son concretas y cerradas.
- [ ] El plan de fase 2 es ejecutable en pasos pequeños con tests definidos de antemano.

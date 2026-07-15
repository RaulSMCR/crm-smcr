# Plan maestro de ejecución — Auditoría CRM SMCR (jul-2026)

Informe completo de la auditoría: https://claude.ai/code/artifact/7df0bc3a-b72b-48de-8b51-1930431b2edd

## Cómo usar estos documentos

1. **Un chat nuevo por tarea.** Pega el contenido completo del archivo de la tarea (`olaX-TXX-*.md`) como primer mensaje. Cada documento es autocontenido: la IA no necesita el informe ni este plan.
2. **Antes de aceptar código**, exige a la IA: (a) que primero liste los archivos que va a leer y su plan en 5 líneas; (b) al final, la lista de archivos cambiados, cómo probar manualmente, y la salida de `npm run lint`, `npm test` y `npm run build`.
3. **Verifica tú los criterios de aceptación** del documento antes de dar la tarea por cerrada.
4. **Un commit por tarea**, con el ID en el mensaje: `git commit -m "T02: bloquear FE mock en producción (FIS-01)"`.
5. Si la IA propone "mejorar de paso" algo fuera del alcance: **no**. Se anota para el backlog y se sigue.
6. Las tareas marcadas ⚠ tienen un paso previo humano (contador, dashboard de Supabase/ONVO, rotación de secretos) que la IA no puede hacer.

## Restricción global

**Cero gastos fijos nuevos hasta salir a producción.** Ninguna tarea contrata servicios. Todo usa lo ya presente: Supabase, Resend, Upstash QStash, Cloudflare Turnstile, PostgreSQL. Lo que requiere gasto (WhatsApp API, proveedor FE, CMP comercial) queda fuera de este plan y se activa al lanzar.

## Orden y dependencias

### Ola 1 — Esta semana (independientes entre sí, cualquier orden)
| Tarea | Hallazgo | Título |
|---|---|---|
| T01 ⚠ | SEC-02 | Limpieza de material sensible en git + rotación de secretos |
| T02 | FIS-01 | Bloquear facturación electrónica simulada en producción |
| T03 | LEG-01 | Banner de consentimiento y tracking condicionado |
| T04 | SEC-01 | Rate limiting y Turnstile en autenticación |

### Ola 2 — Semanas 2–3 (independientes entre sí)
| Tarea | Hallazgo | Título |
|---|---|---|
| T05 | PAY-01 | Webhook ONVO: validación de monto y pagos no conciliados |
| T06 | SEC-03 | Verificación de pertenencia en acciones con IDs |
| T07 ⚠ | SEC-05 | Documentos médicos en buckets privados con URLs firmadas |
| T08 | UX-03 | Constraint de exclusión contra dobles reservas |

### Ola 3 — Semanas 4–6 (T09 antes que T13; T10 antes que T14)
| Tarea | Hallazgo | Título |
|---|---|---|
| T09 ⚠ | FIS-04 | IVA 4% y CABYS en la facturación al paciente |
| T10 ⚠ | FIS-03 | Corregir catálogo de tipos de documento FE |
| T11 | CON-04 | Notas de crédito con signo correcto en reportes |
| T12 | FIS-05 | Datos del emisor FE a variables de entorno |
| T13 ⚠ | FIS-07 | Captura completa de la factura del profesional (crédito fiscal) |
| T14 ⚠ | FIS-02 | Migración de esquemas FE a v4.4 (dos fases) |

### Ola 4 — Semanas 6–9 (requieren T09, T11 y T13 terminadas)
| Tarea | Hallazgo | Título |
|---|---|---|
| T15 | PAY-02 | Liquidación automática de comisiones a profesionales |
| T16 ⚠ | FIS-06 | Módulo de cierre fiscal (D-104, D-101, checklist Hacienda) |
| T17 | CON-01 | Conciliación ONVO ↔ facturas ↔ banco |
| T18 | UX-01 | Pago dentro del panel del paciente |

### Ola 5 — Backlog continuo
Ver `ola5-backlog.md`: prompts cortos para SEO técnico (MKT-01/02), dashboard de adquisición (MKT-04), tests base (ARQ-02), revocación de sesiones (SEC-04) y microcopy (UX-04). Cuando llegue el momento, pedir a Claude que expanda cualquiera a documento completo.

## Decisiones ya tomadas (no re-discutir con las IAs)

- IVA al paciente: **4%** (servicios de salud). IVA de profesionales al sitio: **4%**. Precios aprobados son **IVA incluido**.
- Los profesionales son proveedores independientes que facturan al sitio; el sitio factura el 100% al paciente.
- Pendiente del contador: CABYS por servicio (T09), catálogo oficial v4.4 (T10/T14), retención de adquirentes (T16).

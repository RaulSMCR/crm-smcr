# B07 — Auditoría del árbol administrativo

## Resultado

El árbol operativo es `src/app/panel/admin/*`, que contiene las pantallas actuales de contabilidad, marketing, seguros, servicios, citas y personal.

El árbol `src/app/admin/*` conserva pantallas antiguas de dashboard, citas, posts, profesionales y usuarios. No se eliminaron en esta tarea porque todavía pueden existir enlaces externos o marcadores de usuarios administradores.

## Duplicados extraídos

- `toNumber`, `round2` y cálculo de líneas de factura ahora viven en `src/lib/invoice-math.js`.
- Los endpoints `api/invoices` y `api/invoices/[id]` consumen ese helper.
- La detección de solapamiento común quedó preparada en `src/lib/booking-conflicts.js`; los dos flujos de agenda mantienen sus mensajes y exclusiones específicas hasta una tarea posterior.

## Siguiente decisión manual

Verificar enlaces entrantes a `/admin/*` en Analytics y documentación antes de retirar ese árbol legado.

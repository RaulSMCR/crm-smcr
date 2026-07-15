# F01 — Corregir posición de la cédula en la validación de la clave FE (bug de T13) — P0

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. Los profesionales presentan su factura electrónica al sitio con la clave numérica de 50 dígitos de Hacienda; el sistema valida que la cédula embebida en la clave coincida con la del profesional (`src/lib/supplier-invoice.js`, usada por `src/actions/professional-billing-actions.js`).

## Reglas duras
1. Alcance: `src/lib/supplier-invoice.js`, `tests/unit/supplier-invoice.test.js` y nada más.
2. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema (bug real, bloqueante para los profesionales)
`validateSupplierFeClave` compara `value.slice(3, 15)` contra la cédula. La estructura oficial de la clave de 50 dígitos es:

| Posición (1-index) | Índice slice (0-index) | Contenido |
|---|---|---|
| 1–3 | 0–2 | Código de país (506) |
| 4–9 | 3–8 | Fecha dd/mm/aa (6 dígitos) |
| **10–21** | **9–20** | **Cédula del emisor (12 dígitos, con ceros a la izquierda)** |
| 22–41 | 21–40 | Consecutivo (20 dígitos) |
| 42 | 41 | Situación del comprobante |
| 43–50 | 42–49 | Código de seguridad |

Es decir, la cédula está en `value.slice(9, 21)`, NO en `slice(3, 15)`. Con el código actual, cualquier clave real de un profesional es rechazada con «La cédula de la clave no coincide con su identificación» — ningún profesional podría presentar factura. Puedes confirmar la estructura contra el propio generador del proyecto: `buildFeClave` en `src/lib/fe/xml.js` concatena `pais(3) + fecha(6) + cedula(12) + consecutivo(20) + situacion(1) + seguridad(8)`.

## Pasos
1. Corrige el slice a `value.slice(9, 21)`.
2. Reescribe los tests de `tests/unit/supplier-invoice.test.js` construyendo claves con la estructura REAL (usa la misma composición que `buildFeClave` para el caso feliz): clave válida con cédula coincidente → ok; cédula distinta → error; clave de 49 o 51 dígitos → error; cédula con menos de 12 dígitos correctamente padded → ok.
3. Añade un test de coherencia cruzada: genera una clave con `buildFeClave` de `src/lib/fe/xml.js` (con la cédula del emisor de prueba) y verifica que `validateSupplierFeClave` extrae la cédula de la MISMA posición (así ambas piezas no pueden volver a divergir).

## Qué NO hacer
- No toques el resto de validaciones ni el formulario.
- No cambies `buildFeClave`.

## Criterios de aceptación
- [ ] Una clave real (estructura oficial) con la cédula del profesional pasa la validación.
- [ ] El test cruzado con `buildFeClave` pasa.
- [ ] `npm test` completo en verde.

# T12 — Datos del emisor FE a variables de entorno (FIS-05)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript). Facturación electrónica Hacienda CR en `src/lib/fe/` con constantes del emisor en `config.js`.

## Reglas duras
1. Alcance: `src/lib/fe/config.js`, un archivo nuevo `.env.example`, y los puntos que consumen `FE_EMISOR`/`FE_API`.
2. Comportamiento en producción: si falta configuración crítica, FALLAR con error claro; nunca operar con defaults.
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
En `src/lib/fe/config.js` están hardcodeados: razón social, cédula jurídica, correo personal, teléfono, ubicación, actividad económica, sucursal/terminal y `ambiente: "02"` (pruebas, con comentario "para producción cambiar esta línea"). Además `FE_API` tiene defaults peligrosos: `clientId: "api-stag"` y `p12Pin: "1234"`. Cambiar de ambiente o corregir un dato del emisor exige tocar código y redeploy; un olvido deja producción firmando con PIN por defecto en ambiente de pruebas.

## Pasos

1. Lee `config.js` completo y localiza todos los consumidores de `FE_EMISOR` y `FE_API` (busca en `src/lib/fe/` y en rutas de invoices).
2. Reescribe `config.js` para construir `FE_EMISOR` desde variables de entorno con prefijo `FE_EMISOR_*` (NOMBRE, TIPO_ID, IDENTIFICACION, CORREO, TEL_CODIGO, TEL_NUMERO, PROVINCIA, CANTON, DISTRITO, OTRAS_SENAS, ACTIVIDAD, SUCURSAL, TERMINAL) y `FE_AMBIENTE` (`01` producción, `02` pruebas).
   - Los valores actuales del código pasan a ser los valores del `.env.example` (son datos reales del emisor: consérvalos ahí documentados).
   - Elimina los defaults de `clientId` y `p12Pin`.
3. Función `assertFeConfig()` exportada: valida presencia y formato (cédula numérica, ambiente ∈ {01,02}, actividad de 5–6 dígitos). `submitInvoiceToFe` la invoca solo cuando va a usar la integración real; el error resultante debe dejar la factura en `feStatus: PENDING` con `feErrorMessage` descriptivo (mismo patrón que la tarea T02 dejó para FE no configurada).
4. Regla de seguridad: si `FE_AMBIENTE === "01"` (producción fiscal) pero `NODE_ENV !== "production"`, rechazar con error («No se permite ambiente fiscal de producción fuera de producción»).
5. Crea `.env.example` en la raíz con TODAS las variables que usa el proyecto (busca `process.env.` en `src/` para el inventario completo), con comentarios de una línea y valores de ejemplo o vacíos. Sin secretos reales.
6. Test `tests/unit/fe-config-env.test.js`: config completa → pasa; falta IDENTIFICACION → error claro; ambiente 01 en dev → error.

## Qué NO hacer
- No cambies la estructura del XML ni los namespaces.
- No muevas la configuración a base de datos (decisión futura; env es suficiente para un solo emisor).
- No borres `.env` locales ni imprimas secretos en logs.

## Criterios de aceptación
- [ ] `config.js` sin ningún dato del emisor hardcodeado ni defaults de credenciales.
- [ ] `.env.example` completo y documentado en la raíz.
- [ ] Falta de configuración → factura PENDING con mensaje claro (no crash, no datos simulados).
- [ ] Tests pasan.

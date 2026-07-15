# F03 — getSession consulta la BD en cada llamada: cachear por request — P1

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. La revocación de sesiones (B05) se implementó dentro de `getSession()` en `src/lib/auth.js`: cada llamada verifica `sessionVersion` e `isActive` contra la base con `prisma.user.findUnique`, y además resuelve el modo «ver como» del admin.

## Reglas duras
1. Alcance: `src/lib/auth.js` y verificación de consumidores; no cambies la semántica de revocación.
2. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
`getSession()` se invoca muchas veces por request (layout del panel, página, varias server actions y componentes de servidor). Cada invocación es ahora una consulta a la BD: en una página de panel típica son 3–6 queries idénticas por render. Además hay que garantizar que ninguna página pública con ISR (`/`, `/blog`, `/servicios`, `/profesionales/[slug]`) llame `getSession` en el server, porque `cookies()` las volvería dinámicas y anularía el caché.

## Pasos
1. Envuelve la implementación con `cache()` de React (`import { cache } from "react"`): la primera llamada del request consulta la BD; las siguientes en el MISMO request reutilizan el resultado. La revocación sigue siendo efectiva request a request (no proceses ni TTLs entre requests — eso mantiene la garantía de seguridad).
2. Audita los consumidores: busca `getSession` en `src/app/` y confirma que NINGUNA página pública con `export const revalidate` la usa en el server (los componentes como el Header que muestran estado de sesión deben resolverlo del lado cliente o vivir fuera del árbol estático). Si encuentras una violación, repórtala en el resumen con propuesta — no la arregles sin avisar si implica mover UI.
3. Verifica que `npm run build` siga mostrando `/`, `/blog`, `/servicios` como estáticas (○) tras el cambio.
4. Test simple: dos llamadas consecutivas a `getSession` dentro del mismo "request" mockeado ejecutan una sola consulta Prisma (spy sobre `findUnique`).

## Qué NO hacer
- No introduzcas caché entre requests (Redis, memoria global, TTL): rompería la revocación inmediata.
- No quites la verificación de `sessionVersion`/`isActive`.

## Criterios de aceptación
- [ ] Una página de panel ejecuta exactamente 1 query de sesión por request.
- [ ] Las páginas públicas siguen estáticas en el build.
- [ ] Revocación intacta: desactivar un usuario lo saca en su siguiente request.

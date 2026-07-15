# T04 — Rate limiting y Turnstile en autenticación (SEC-01)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL (Supabase), auth propia con JWT (cookie `session`), correos Resend. Cloudflare Turnstile ya está integrado (`@marsidev/react-turnstile`) y funcionando en el formulario de contacto: `src/app/api/contact-faq/route.js` y `src/components/FaqContactSection.js` — úsalo como referencia de patrón (verificación server-side con `TURNSTILE_SECRET_KEY`).

## Reglas duras
1. NO agregues servicios nuevos (nada de Upstash Redis ni similares): el rate limiting se implementa contra la base PostgreSQL existente vía Prisma.
2. Alcance quirúrgico: archivos listados abajo + una migración Prisma.
3. Si cambias `prisma/schema.prisma`, genera migración con `npx prisma migrate dev --name rate_limiting` (no `db push`).
4. Textos de error en español de Costa Rica, con tildes, sin revelar si el correo existe.
5. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
No hay límite de intentos en: `login()` (`src/actions/auth-actions.js`), `/api/auth/forgot-password`, `/api/auth/resend-verification`, ni en los registros. Permite fuerza bruta de contraseñas y bombardeo de correos (Resend cobra por envío).

## Pasos

1. Modelo nuevo en `prisma/schema.prisma`:
   ```prisma
   model RateLimitEntry {
     id        String   @id @default(cuid())
     key       String   // ej. "login:1.2.3.4:correo@x.com"
     createdAt DateTime @default(now())
     @@index([key, createdAt])
   }
   ```
2. Helper `src/lib/rate-limit.js`: `async checkRateLimit(key, { max, windowMinutes })` → cuenta entradas de la ventana; si `count >= max` devuelve `{ limited: true, retryAfterMinutes }`; si no, inserta una entrada y devuelve `{ limited: false }`. Incluye limpieza oportunista (borra entradas viejas de esa key en la misma llamada). Debe fallar ABIERTO (si la BD falla, no bloquear el login) con `console.error`.
3. Aplica límites (IP se obtiene de `x-forwarded-for` primer valor, o `headers()` en server actions):
   - `login`: 5 intentos fallidos / 15 min por `login:{ip}:{email}`. Solo cuenta intentos FALLIDOS. Mensaje: «Demasiados intentos. Esperá unos minutos e intentá de nuevo.»
   - `forgot-password`: 3 / 60 min por `forgot:{ip}` y 3 / 60 min por `forgot:{email}` — manteniendo la respuesta neutra existente (devolver el mismo mensaje neutro aunque esté limitado, sin enviar correo).
   - `resend-verification`: 3 / 60 min por email, misma respuesta neutra.
   - `registerUser` y `registerProfessional`: 5 / 60 min por IP.
4. Turnstile en formularios públicos de auth, reutilizando el patrón de `FaqContactSection`:
   - Login (`src/app/ingresar/`), registro de usuario y de profesional (`src/app/registro/*`), recuperación (`src/app/recuperar/`).
   - Verificación server-side del token en la action/route correspondiente. Si `TURNSTILE_SECRET_KEY` no está configurada, el check se omite con `console.warn` (para no romper desarrollo).

## Qué NO hacer
- No cambies la lógica de credenciales ni los mensajes neutros existentes.
- No implementes lockout permanente de cuentas (solo ventanas temporales).
- No uses memoria del proceso para contar (serverless: cada invocación puede ser una instancia nueva).

## Criterios de aceptación
- [ ] 6.º intento fallido de login en 15 min → mensaje de espera; un login correcto antes del límite sigue funcionando.
- [ ] `forgot-password` limitado responde neutro y NO envía correo (verificar por logs).
- [ ] Los 4 formularios públicos muestran Turnstile y el server rechaza token inválido.
- [ ] Test unitario de `checkRateLimit` (ventana, conteo, fail-open) en `tests/unit/rate-limit.test.js`.

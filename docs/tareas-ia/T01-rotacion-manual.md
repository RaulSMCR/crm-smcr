# T01 — Rotación manual de secretos (SEC-02)

> **Por qué esto es necesario.** En el historial de git quedaron versionados
> `cookies.txt` (cookie jar de curl, con un token de sesión que pudo estar vivo) y
> `dev.*.log` / `build-output.txt` (logs de desarrollo que pueden haber impreso
> secretos en tiempo de ejecución). Aunque los archivos `.env*` están en
> `.gitignore` (sus valores no deberían estar en el historial), **cualquier
> secreto que haya aparecido en esos logs o en la cookie debe considerarse
> comprometido**. Rotá los de prioridad ALTA sí o sí; los de prioridad MEDIA por
> precaución, ya que viven en el mismo `.env` que alimentó esos procesos.

Estos pasos los tenés que hacer **vos** (la IA no tiene acceso a los dashboards).
Marcá cada casilla al completarla.

## Prioridad ALTA — rotar ya

| # | Secreto (variable env) | Dónde se rota | Notas |
|---|---|---|---|
| [ ] 1 | `SESSION_SECRET` | Lo generás vos: `openssl rand -base64 48` (o `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`) y lo pegás en `.env.local` + variables de entorno de Vercel | **Invalida todas las sesiones activas** (todos deben volver a iniciar sesión). Esto es lo que vuelve inútil cualquier token filtrado en `cookies.txt`. Hacelo primero. |
| [ ] 2 | `ONVO_SECRET_KEY` | Dashboard de ONVO Pay → API keys → regenerar | Es la llave secreta de la API de pagos. |
| [ ] 3 | `ONVO_WEBHOOK_SECRET` | Dashboard de ONVO Pay → Webhooks → regenerar firma del webhook | Al rotarla, actualizá la variable y confirmá que el endpoint `/api/payment/webhook` sigue validando. |
| [ ] 4 | `RESEND_API_KEY` | Dashboard de Resend (resend.com) → API Keys → revocar la vieja y crear nueva | Resend cobra por envío; una key filtrada permite spam a tu costa. |
| [ ] 5 | `SUPABASE_SERVICE_ROLE_KEY` | Dashboard de Supabase → Project Settings → API → "Reset service_role key" | Da acceso total a la base saltando RLS. Máxima prioridad junto con la de sesión. |
| [ ] 6 | `DATABASE_URL` y `DIRECT_URL` (contraseña de Postgres) | Dashboard de Supabase → Project Settings → Database → "Reset database password" | La contraseña va embebida en ambas cadenas de conexión; actualizá las dos variables. |

## Prioridad ALTA — credenciales de Facturación Electrónica (Hacienda)

| # | Secreto (variable env) | Dónde se rota | Notas |
|---|---|---|---|
| [ ] 7 | `FE_PASSWORD` | Portal de Hacienda / ATV (usuario de facturación electrónica) | Contraseña del usuario emisor. |
| [ ] 8 | `FE_P12_PIN` | Se define al regenerar/exportar la llave criptográfica `.p12` en el portal de Hacienda | Si rotás el `.p12`, actualizá también `FE_P12_BASE64`. |
| [ ] 9 | `FE_USERNAME` | Portal de Hacienda | Normalmente no se "rota", pero verificá que no haya quedado en logs; si el usuario cambió, actualizá la variable. |
| [ ] 10 | `FE_P12_BASE64` | Volvé a exportar el `.p12` desde Hacienda y recodificá en base64 | Va de la mano con el PIN (#8). |

## Prioridad MEDIA — rotar por precaución

| # | Secreto (variable env) | Dónde se rota | Notas |
|---|---|---|---|
| [ ] 11 | `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs y servicios → Credenciales → cliente OAuth → "Restablecer secreto" | El `GOOGLE_CLIENT_ID` es público; el que se rota es el secret. Revisá también tokens OAuth de usuarios si se registraron en logs. |
| [ ] 12 | `QSTASH_TOKEN` | Consola de Upstash → QStash → rotar token | Token de publicación de jobs. |
| [ ] 13 | `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY` | Consola de Upstash → QStash → Signing keys → rotar | Firman las notificaciones de QStash; rotá ambas. |
| [ ] 14 | `TURNSTILE_SECRET_KEY` | Dashboard de Cloudflare → Turnstile → tu widget → "Rotate secret key" | La `NEXT_PUBLIC_TURNSTILE_SITE_KEY` es pública; solo se rota el secret. |

## Notas finales

- **No hace falta rotar** las variables `NEXT_PUBLIC_*` (son públicas por diseño:
  URLs, `SUPABASE_ANON_KEY`, site keys), salvo que sospeches abuso.
- Tras rotar, actualizá los valores en **ambos** lugares: `.env.local` (local) y
  las **Environment Variables de Vercel** (producción), y redeploy.
- La rotación es independiente de la purga del historial de git: aunque limpiés el
  historial, cualquier secreto ya expuesto pudo ser copiado, así que **rotar es
  obligatorio**, no opcional.

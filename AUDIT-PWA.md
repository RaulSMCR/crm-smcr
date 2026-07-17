# AUDIT-PWA.md — Auditoría previa a la PWA de pacientes

> Auditoría de **solo lectura**. No se modificó ningún archivo del proyecto.
> Fecha: 2026-07-17 · Stack detectado: Next.js 16.2.10 (App Router) · React 18.2.0 · Prisma 5.22 · Tailwind 3.4.

---

## 1. AUTH DE PACIENTES

**Mecanismo: usuario + contraseña (bcrypt). No hay magic link ni OAuth para pacientes.**
El OAuth de Google existe pero es solo para conectar Google Calendar de los **profesionales** (`googleRefreshToken` en `ProfessionalProfile`), no para login.

- [`src/actions/auth-actions.js`](src/actions/auth-actions.js) — Server actions `registerUser` (L398), `registerProfessional` (L232), `login` (L139), `logout` (L522), `verifyEmail` (L497). El registro exige verificación de correo por token (`verifyTokenHash`/`verifyTokenExp` en `User`); sin verificar, el login devuelve `EMAIL_NOT_VERIFIED`. Contraseña con `bcryptjs`; rate-limit de 5 intentos/15 min + Turnstile.
- [`prisma/schema.prisma`](prisma/schema.prisma) — **Un solo modelo `User` para todos los roles** (L105). El paciente es `User` con `role = USER` (enum `Role { USER, PROFESSIONAL, ADMIN }`, L13). El profesional es `User role=PROFESSIONAL` + un `ProfessionalProfile` 1:1 (L176). **No hay tablas separadas ni RLS**; la distinción es el campo `role`.
- [`src/lib/auth.js`](src/lib/auth.js) — La sesión es un **JWT propio firmado con `jose` (HS256)** en cookie `httpOnly` llamada `session` (`setSessionCookie`, L143), expiración 7 días, `sameSite: lax`. `getSession()` (L97) está envuelto en `cache()` de React y **revalida `sessionVersion` + `isActive` contra la BD en cada request** (revocación efectiva). Soporta modo admin «ver como» vía cookie `admin_view`.
- **Supabase NO se usa para auth.** Solo Storage: [`src/lib/supabase-admin.js`](src/lib/supabase-admin.js), [`src/lib/supabase-client.js`](src/lib/supabase-client.js) y subidas de archivos.

---

## 2. RUTAS EXISTENTES DEL PACIENTE

Todo cuelga de `/panel/paciente` (rol `USER`). No existe hoy ninguna ruta `/mi/*`.

| Ruta | Archivo | Qué muestra |
|------|---------|-------------|
| `/panel/paciente` | [`src/app/panel/paciente/page.js`](src/app/panel/paciente/page.js) | Dashboard: mis citas, perfil editable, seguro, contador de pagos pendientes/sin pagar. |
| `/panel/paciente/agendar` | [`src/app/panel/paciente/agendar/page.js`](src/app/panel/paciente/agendar/page.js) | Reserva sobre un `professionalId`+`serviceId` (viene de `/servicios`). |
| `/panel/paciente/pago/resultado` | [`src/app/panel/paciente/pago/resultado/page.js`](src/app/panel/paciente/pago/resultado/page.js) | Estado del pago tras volver de ONVO (`?ref=<appointmentId>`). |

**Componentes usados:** [`UserAppointmentsPanel`](src/components/UserAppointmentsPanel.js) (lista + cancelar/reagendar + botón de pago ONVO), [`PatientProfileEditorCard`](src/components/paciente/PatientProfileEditorCard.js), [`InsurancePatientUploader`](src/components/paciente/InsurancePatientUploader.js), [`ProfessionalCalendarBooking`](src/components/booking/ProfessionalCalendarBooking.js).

- **No hay historial de lectura de blog visible para el paciente** en ninguna de estas páginas.
- **No existe `src/app/panel/page.js`.** Las páginas de paciente hacen `redirect("/panel")` cuando el rol no es `USER`, y esa ruta hoy da 404 (ver RIESGOS).
- No hay `layout.js` propio bajo `/panel/paciente`: se usa el layout raíz (header/footer públicos).

---

## 3. AGENDA

**Modelo: `Appointment`** ([`prisma/schema.prisma`](prisma/schema.prisma) L467). Horarios del profesional en `Availability` (L450). Estados: `AppointmentStatus { PENDING, CONFIRMED, CANCELLED_BY_USER, CANCELLED_BY_PRO, COMPLETED, NO_SHOW }`.

Server actions de paciente en [`src/actions/patient-booking-actions.js`](src/actions/patient-booking-actions.js):
- `createAppointmentForPatient` (L70), `cancelAppointmentByPatient` (L193), `rescheduleAppointmentByPatient` (L297), `confirmCurrentAppointmentByPatient` (L405), `getAppointmentRescheduleData` (L259).

**Reglas detectadas:**
- Cancelar y reagendar **solo si el estado es `PENDING` o `CONFIRMED`**; en otro caso se rechaza.
- Cancelación con <24 h de antelación **no se bloquea**, solo devuelve `isLateCancel: true` (marca informativa).
- Reagendar valida `newStart > now` y detecta conflictos de solapamiento (`findRecurringConflict`); soporta recurrencia. **No hay anticipación mínima dura** para reagendar/cancelar más allá de que la fecha sea futura.
- Toda cita se valida siempre contra `patientId === session.sub` (aislamiento por paciente).
- Al crear/reagendar se programan recordatorios QStash 24 h y 1 h (ver punto 6).

---

## 4. PAGOS ONVO

**Los enlaces de pago ONVO son estáticos y preconfigurados**, asociados a la asignación profesional-servicio (`ServiceAssignment.onvoPaymentLinkId`), **no se generan por cita**.

- [`src/lib/onvo/client.js`](src/lib/onvo/client.js) — `buildPaymentLinkUrl(linkId)` → `https://checkout.onvopay.com/pay/{linkId}`.
- [`src/lib/payment-requests.js`](src/lib/payment-requests.js) — `createPaymentRequestForAppointment` resuelve el `onvoPaymentLinkId` de la asignación, crea un `PaymentTransaction` en estado `LINK_SENT` y manda el enlace por email. Divide el primer pago en `DEPOSIT_50` / `BALANCE_50` o `FULL_100`.
- **Campos de estado (doble):**
  - `PaymentTransaction.status` — `PaymentTransactionStatus { PENDING, LINK_SENT, APPROVED, REJECTED, REFUNDED, EXPIRED }` (schema L41).
  - `Appointment.paymentStatus` — `PaymentStatus { UNPAID, PARTIALLY_PAID, PAID, REFUNDED }`.
- **Webhook: [`src/app/api/payment/webhook/route.js`](src/app/api/payment/webhook/route.js)** (`/api/payment/webhook`). Es **público** (excluido del middleware). Verifica firma HMAC-SHA256 ([`src/lib/onvo/webhook.js`](src/lib/onvo/webhook.js)), es idempotente por `onvoEventId` (`@unique`), y como los enlaces son **compartidos** empareja el evento por monto+moneda+email con [`src/lib/onvo/match-payment.js`](src/lib/onvo/match-payment.js) — nunca adivina; si hay ambigüedad registra `UnmatchedPayment` y alerta al admin. Al aprobar: actualiza tx + `Appointment.paymentStatus`, crea factura automática, dispara FE de Hacienda, envía email y conversiones GA4/Meta.

---

## 5. HISTORIAL DE LECTURA

**Modelo: `PostViewEvent`** ([`prisma/schema.prisma`](prisma/schema.prisma) L702). Único por `@@unique([sessionId, postId])`.

- [`src/app/api/blog/[slug]/track/route.js`](src/app/api/blog/[slug]/track/route.js) — Al abrir un artículo hace `upsert` del evento con cookies **propias del blog** `anon_id` (1 año) y `sess_id` (30 min, sliding). Guarda UTMs, referrer, user-agent, país.
- [`src/app/api/blog/[slug]/view/route.js`](src/app/api/blog/[slug]/view/route.js) — Incrementa el contador `Post.views` (dedupe por cookie `pv_<slug>` 24 h).
- [`src/app/api/blog/events/[id]/route.js`](src/app/api/blog/events/[id]/route.js) — PATCH/POST (sendBeacon) que actualiza `timeOnPageSeconds`, `scrollDepth` y marca **`isRead` / `readAt`** cuando el usuario realmente leyó.

**¿Comparten sesión el blog y el área de paciente? NO.**
- El blog es **público** y trackea con `anon_id`/`sess_id` propias, **no con la cookie `session`** del paciente.
- `PostViewEvent.userId` es **nullable** y solo se rellena en el **registro**, matcheando la cookie `anon_id` (`linkAnonymousMarketingEvents`, [`src/actions/auth-actions.js`](src/actions/auth-actions.js) L96). **No se vincula en el login.** → Un paciente que ya tenía cuenta y lee el blog logueado genera eventos con `userId = null`.

---

## 6. INFRAESTRUCTURA PWA PREVIA

**Estado: manifest presente pero sin enlazar; sin service worker; sin push. QStash sí existe para jobs.**

- **Manifest:** existe [`public/site.webmanifest`](public/site.webmanifest) (name, short_name, iconos maskable 192/512, `display: standalone`), **pero NO está enlazado**: [`src/app/layout.js`](src/app/layout.js) no tiene `metadata.manifest` ni `<link rel="manifest">`. Además le faltan `start_url`, `scope` e `id`.
- **Iconos:** `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`, `apple-touch-icon.png`, `favicon.svg` en `public/`.
- **Service worker: NINGUNO.** Búsqueda de `serviceWorker`/`workbox`/`sw.js` sin resultados.
- **Librería de push: NINGUNA.** No hay `web-push`, `next-pwa`, `serwist`, `workbox` ni `VAPID` en `package.json` ni en el código. No hay tabla de suscripciones push en Prisma.
- **Jobs / recordatorios: SÍ, QStash (`@upstash/qstash`).** [`src/lib/qstash.js`](src/lib/qstash.js) `scheduleReminder({appointmentId, type: "24h"|"1h", sendAt})` publica a [`src/app/api/reminders/send/route.js`](src/app/api/reminders/send/route.js) (firmado con `verifySignatureAppRouter`), que hoy envía **email** vía `sendAppointmentNotifications`. Llamado desde `agenda-actions.js`, `booking-actions.js`, `patient-booking-actions.js`. También hay un Vercel Cron ([`vercel.json`](vercel.json)) para `/api/cron/settlements`.

---

## 7. ESTRUCTURA

- **Router:** **App Router**, todo bajo [`src/app/`](src/app/) (hay `middleware.js` en `src/`). **Next.js 16.2.10**, React 18.2.0, Node 24.
- **Componentes compartidos:** [`src/components/`](src/components/) (34 en la raíz) con subcarpetas `ui/`, `auth/`, `booking/`, `paciente/`, `profesional/`, `admin/`, `blog/`, `appointments/`, `tracking/`, `profile/`. Lógica en [`src/lib/`](src/lib/) y [`src/actions/`](src/actions/) (server actions con `"use server"`).
- **Estilos:** **Tailwind 3.4.14**, sin CSS modules. Plugins `@tailwindcss/typography` y `@tailwindcss/forms`. `darkMode: 'class'`.
- **Paleta / tokens de marca (definidos en código):**
  - Tokens como CSS vars RGB en [`src/app/globals.css`](src/app/globals.css): `--brand-*` (teal, `--brand-600 = 43 112 115`), `--accent-*` (coral, `--accent-600 = 251 122 98`), `--neutral-*` (cálidos), `--app-bg = 246 239 223`. Semánticos `--success/--warning/--danger` y ratios 60/30/10.
  - Mapeados en [`tailwind.config.mjs`](tailwind.config.mjs) como `brand`/`accent`/`neutral`. **Aliases que fuerzan la marca:** `blue/indigo/sky/emerald/green…` → `brand`; `amber/red/rose/purple…` → `accent`; `gray/slate/zinc…` → `neutral`. Radio `2xl: 1rem`, sombra `card`.

---

## RIESGOS para montar `/mi/*` con la sesión de paciente existente

1. **El middleware NO protegería `/mi/*`.** [`src/middleware.js`](src/middleware.js) solo cubre 4 prefijos (`/panel/admin`, `/panel/profesional`, `/panel/paciente`, `/api/admin`, L30). Cualquier ruta que no matchee cae en `NextResponse.next()` **sin auth**. Hay que añadir `{ prefix: "/mi", role: "USER" }` (y su API equivalente) o `/mi/*` quedaría público. Igual para páginas nuevas + endpoints JSON de la PWA.

2. **No hay helper de sesión para API routes que devuelva JSON.** `getSession()` está pensado para Server Components/actions (usa `cache()` de React). El middleware solo responde `401/403`. La PWA necesitará un patrón claro de "sesión en route handler" para sus endpoints (`/api/mi/*`), reutilizando `getSession()` pero devolviendo JSON.

3. **Cookie de sesión `httpOnly` + `sameSite: lax`, 7 días, sin refresh.** Es buena para seguridad (un service worker no puede leer el JWT, pero `fetch` con `credentials` sí lo envía). Para una PWA instalada de larga vida conviene una estrategia de renovación; hoy la sesión simplemente caduca a los 7 días y no hay refresh token.

4. **Next 16: `params`/`searchParams` son `Promise`.** Múltiples páginas actuales (incluidas las del paciente y varias rutas dinámicas de API) acceden a `searchParams?.x` / `params.slug` **de forma síncrona**. Según el comportamiento de Next 16 esto devuelve `undefined` y rompe rutas dinámicas. Las nuevas rutas `/mi/*` **deben usar `await params` / `await searchParams`** desde el inicio para no arrastrar el bug.

5. **`/panel` no tiene `page.js`.** Las páginas de paciente hacen `redirect("/panel")` que hoy da 404. Si `/mi/*` reutiliza ese patrón de guardas, hay que crear un destino real (p. ej. redirigir a `/mi` o `/panel/paciente`).

6. **Blog y paciente NO comparten sesión.** El "historial de lectura" del paciente no es trivial: `PostViewEvent.userId` solo se rellena en el registro (match por `anon_id`), **no en login**. Para mostrar "lo que leíste" en `/mi` habrá que (a) vincular `userId` también en el login, o (b) consultar por `anonId`, asumiendo que el blog y la PWA compartan la cookie `anon_id` (hoy el blog usa cookies distintas de la de sesión).

7. **Los enlaces ONVO son estáticos y compartidos por asignación pro-servicio.** Una vista de pago en la PWA **no puede asumir "1 enlace = 1 cita"**. El estado real de pago hay que leerlo de `PaymentTransaction.status` + `Appointment.paymentStatus`, no del enlace. La conciliación puede quedar en `MULTIPLE_CANDIDATES`/`UnmatchedPayment` (pago sin acreditar automáticamente).

8. **Push desde cero.** No hay service worker, ni librería de push, ni tabla de suscripciones, ni claves VAPID. La PWA de recordatorios push requiere: SW en scope raíz, `web-push`/serwist, modelo Prisma `PushSubscription`, endpoint para guardar/borrar suscripciones y **reutilizar QStash** (que hoy solo dispara email) para enviar la notificación push en el job `/api/reminders/send`.

9. **Manifest incompleto y sin enlazar.** Falta añadir `metadata.manifest` en el layout y completar `start_url`/`scope`/`id`. Con `display: standalone` pero sin `start_url`, la app instalada no tiene punto de entrada definido (idealmente `/mi`).

10. **Supabase no aporta a la auth de la PWA.** Solo es Storage; no hay Supabase Auth ni RLS que reutilizar. Toda la seguridad de `/mi/*` recae en el JWT propio + middleware + los checks `patientId === session.sub` que ya usan las server actions.

11. **`redirect("/panel")` para rol equivocado + rutas `force-dynamic`.** Todas las páginas de paciente son `export const dynamic = "force-dynamic"`. Está bien para datos por-usuario, pero implica que **nada de `/mi/*` será cacheable/offline por defecto**; la estrategia offline de la PWA (SW) tendrá que decidir explícitamente qué precachear (shell) frente a los datos dinámicos por paciente.

---

## DECISIONES

Decisiones de diseño tomadas durante la implementación de `/mi/*` (no son bugs; se documentan para que queden explícitas).

1. **Historial de lectura vinculado en registro y en login — limitación cross-device conocida.** `PostViewEvent.userId` ahora se adjudica también al iniciar sesión (`login` llama a `linkAnonymousMarketingEvents`, que reasigna los eventos anónimos de la cookie `anon_id` de ese dispositivo), cerrando el hueco de RIESGOS-6 para el dispositivo donde el paciente se loguea. **Limitación que NO se resuelve acá:** la lectura hecha en otro dispositivo donde el paciente todavía no se logueó queda anónima (ligada solo a `anon_id`) hasta el **próximo login en ese dispositivo**. No hay identidad de lectura entre dispositivos previa al login; resolverlo requeriría vincular por email/identidad al leer (fuera de alcance) o sincronizar `anon_id` entre dispositivos (no factible sin login).

2. **"Para vos" usa afinidad por AUTOR, no por categoría/tag.** El modelo `Post` **no tiene categorías ni tags** (el único `category` del schema es de `Product`), así que la recomendación se deriva de los **autores** de los posts que el paciente ya leyó (cada autor es un profesional con su especialidad) → otros posts publicados de esos autores que aún no vio. Sin historial (o si se agota la afinidad) cae en **"Últimas publicaciones"** (5 más recientes). Si en el futuro se agregan categorías/tags a `Post`, esta señal se puede refinar sin cambiar la estructura de la vista.

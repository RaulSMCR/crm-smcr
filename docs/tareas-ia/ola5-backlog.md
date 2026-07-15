# Ola 5 — Backlog continuo (prompts cortos)

Estos son prompts abreviados para tareas de crecimiento y deuda técnica. Cuando toque ejecutar una, pedir a Claude que la expanda al formato completo de las tareas T01–T18 (contexto + reglas + pasos + criterios). Cada bloque entre `---` se puede pegar tal cual a Opus/Codex agregándole el bloque de contexto estándar.

> **Antes de ejecutar un bloque, verificar el estado real en el código.** Al ejecutar B03/B04/B07/B08 (15-jul-2026) se encontró que olas anteriores ya los habían cubierto en buena parte sin marcarlo aquí, y algunas descripciones estaban desactualizadas («solo existen 2 archivos de test» cuando había 17). Peor: `booking-conflicts.js` figuraba como hecho de facto pero era código muerto —creado sin migrar los llamadores—. Los diagnósticos de este documento son del momento en que se escribió, no del presente.
>
> **Estado (15-jul-2026): todos los bloques cerrados.** B01 ✅ · B02 ✅ · B03 ✅ · B04 ✅ · B05 ✅ · B06 ✅ · B07 ✅ · B08 ✅ · B09 ✅.
>
> Residuales, solo los que dependen de producción:
> - **B09:** verificar en producción que un CV antiguo abre vía `/api/files` (no se pudo en local: `SUPABASE_SERVICE_ROLE_KEY` vacía).
> - **B02:** validar los JSON-LD con el Rich Results Test de Google (requiere HTML de producción).
>
> Los demás residuales se cerraron el 15-jul-2026: árbol viejo eliminado, rutas sin autenticación eliminadas, vigencia de los correos parametrizada, URL base centralizada, contradicción robots/sitemap corregida. Ver las notas de cada bloque.

## Bloque de contexto estándar (pegar al inicio de cada prompt)

> CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Tailwind, Prisma 5 + PostgreSQL (Supabase), auth propia JWT, pagos ONVO, correos Resend, jobs QStash. Reglas: no agregar servicios con costo; alcance quirúrgico (solo archivos de la tarea); textos es-CR con tildes; al terminar `npm run lint`, `npm test` y `npm run build` sin errores nuevos + lista de archivos cambiados y cómo probar.

---

## B01 — ISR en páginas públicas (MKT-01) — ✅ HECHO (15-jul-2026)
~~Las páginas públicas usan `force-dynamic`/`revalidate 0`~~ (Dato viejo: el ISR ya estaba aplicado.) Cambia a ISR: home, `/servicios` y `/blog` con `revalidate = 300`; `/blog/[slug]` y `/profesionales/[slug]` con `revalidate = 3600`. Al publicar/editar/archivar un post o servicio (actions y rutas admin correspondientes), llama `revalidatePath()` de las rutas afectadas. Los paneles (`/panel/*`) siguen dinámicos. Verifica que ninguna página pública lea cookies/sesión en el server (eso rompería ISR).

Los `revalidate` ya coincidían con la spec y ninguna página pública lee sesión (la única que lo hace es `/contacto`, fuera de esta lista). **Lo que faltaba era la otra mitad: la invalidación.** Los artículos se editan por rutas API que no llamaban `revalidatePath`, así que el contenido quedaba desactualizado hasta que venciera la ventana ISR (hasta 1 hora):

- `api/professional/posts/[id]` **PATCH** devuelve el artículo a `DRAFT` (lo despublica) y **DELETE** lo elimina: ninguno revalidaba. Un artículo despublicado o borrado por su autor seguía visible en `/blog` y en su slug. Corregido con un helper `revalidatePublicPost(slug)`.
- `api/admin/posts/[id]/approve` publica el artículo sin revalidar. Corregido.
- `createService` en `service-actions.js` solo revalidaba el panel, mientras que editar sí revalidaba `/servicios`. Un servicio nuevo no aparecía. Corregido.
- Las actions de blog (`updatePostStatus`, `updateAdminPost`) revalidaban `/blog` y el slug pero no `/`, y **la home también lista artículos publicados**. Agregado.

Crear un artículo (`POST /api/posts`) lo deja en `DRAFT`, así que no afecta lo público: no necesita revalidación.

---

## B02 — Sitemap con slugs y schemas de alto valor (MKT-02) — ✅ YA ESTABA (verificado 15-jul-2026)
En `src/app/sitemap.js`: los profesionales deben apuntar a `/profesionales/{slug}` (hoy `/agendar/{id}`). Añade JSON-LD: `FAQPage` en `/faq` (con las preguntas reales de la página), `MedicalBusiness` (u `Organization` extendida con `medicalSpecialty`) en la home, `Service` con `Offer` (precio en CRC) en `/servicios/[id]`, y `BreadcrumbList` en blog y perfiles. Usa el componente `JsonLd` existente. Añade `alternates.canonical` en `/agendar/[id]` apuntando al perfil del profesional.

**No se cambió nada: todo estaba implementado.** Verificado punto por punto:
- Sitemap: los profesionales ya apuntan a `/profesionales/{slug}` (`sitemap.js:57-62`).
- `FAQPage` en `/faq`: deriva de las mismas `faqSections` que renderiza la página, así que no puede divergir del contenido visible.
- `MedicalBusiness` con `medicalSpecialty` en la home; `Service` + `Offer` en CRC en `/servicios/[id]`; `BreadcrumbList` en blog, perfiles y servicios.
- `alternates.canonical` en `/agendar/[id]` ya apunta al perfil, con respaldo a la propia URL si el profesional no tiene slug.

Queda pendiente el criterio de validación con el Rich Results Test de Google, que requiere HTML renderizado de producción.

**URL base — ✅ CENTRALIZADA (15-jul-2026).** Al revisarlo resultó peor de lo anotado: no eran tres formas sino **cuatro variables de entorno** para el mismo concepto (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`, las cuatro definidas en `.env.local` con el mismo valor) más **33 apariciones del dominio escrito a mano en 16 archivos**.

Ahora todo sale de `src/lib/site-url.js` (`SITE_URL` y `siteUrl(path)`), que acepta las cuatro variables por precedencia para no obligar a tocar los despliegues. Cero dominios escritos a mano fuera de ese módulo (salvo redes sociales y correo de contacto, que son otra cosa). Cubierto por `tests/unit/site-url.test.js`.

Un test encontró un bug en el propio módulo mientras se escribía: una variable puesta en blanco es *truthy* y, encadenada con `||`, tapaba en silencio a las siguientes. Ahora se normaliza cada candidata antes de elegir.

**Contradicción robots/sitemap corregida (hallazgo nuevo):** `robots.js` bloqueaba `/registro` mientras el sitemap publicaba `/registro` y `/registro/profesional` — Search Console lo reporta como error («Sitemap contains URLs blocked by robots.txt»), y esas son justamente las páginas de captación. Se resolvió a favor de indexarlas: el disallow quedó en `['/api/', '/panel/', '/ingresar']` y `/ingresar` salió del sitemap. De paso se quitaron `/admin/` (ya no existe) y `/dashboard/` (nunca existió) y se agregó `/panel/`, que es el área privada real y no estaba cubierta.

---

## B03 — Dashboard de adquisición (MKT-04) — ✅ HECHO (15-jul-2026)
Todo se captura ya (`User.acquisitionChannel/campaignName`, `PostViewEvent` con UTM/scroll/tiempo) pero no se visualiza. Página `/panel/admin/marketing/adquisicion` (solo ADMIN): registros por canal/campaña por mes; embudo del período (visitas con anonId → registros → primera cita COMPLETED → paciente recurrente ≥2 citas); top 10 artículos por lecturas y por conversión a registro (join PostViewEvent.userId). Gráficos simples con tablas + barras CSS (sin librerías nuevas). Criterio: los números cuadran con consultas SQL de verificación incluidas en el resumen.

La página se había construido en una ola anterior. En esta pasada se corrigieron tres defectos:
- **Recurrentes fuera del período:** el `groupBy` de citas no filtraba por fecha, así que la última etapa del embudo mostraba el histórico completo y no cambiaba al mover el mes. Ahora se deriva de las citas COMPLETED del período (≥2 en el mes).
- **Top de artículos sobre un muestreo:** se leían `take: 100` posts sin `orderBy`, por lo que el «top 10 por lecturas» podía omitir los más leídos. Ahora se agrega sobre los propios `PostViewEvent` del período.
- **Ranking de conversión derivado:** `topConversions` reordenaba el top-10 por lecturas, no rankeaba todos los artículos. Ahora ambos rankings se calculan sobre el total.

Se eliminaron 2 de las 5 consultas (el `groupBy` global y el `findMany` de posts).

---

## B04 — Suite de tests base (ARQ-02) — ✅ HECHO (15-jul-2026)
~~Solo existen 2 archivos de test.~~ (Dato viejo: al ejecutar ya había 17 archivos y 85 tests de olas anteriores.) Añade, en orden: (1) `invoice-math` y totales de factura con IVA 4%/13% y descuentos (si T09 ya existe, amplía); (2) clave numérica y consecutivo FE contra 3 ejemplos construidos a mano; (3) matcher del webhook (si T05 ya existe, amplía casos); (4) conflictos de agenda con recurrencias y límites de zona horaria (`src/lib/timezone.js`, `appointment-slots.js`). Nada de tests triviales de render. Criterio: `npm run test:coverage` muestra los módulos de dinero y FE por encima del 80%.

**Resultado: 138 tests en 20 archivos (antes 85 en 17).** Archivos nuevos:
- `tests/unit/fe-clave.test.js` — clave numérica y consecutivo contra los 3 ejemplos hechos a mano que pedía el punto (2), más descomposición campo por campo de la clave. Requiere fijar `FE_EMISOR_*` con `vi.stubEnv` + `vi.resetModules` antes del import, porque `config.js` congela el emisor al cargarse.
- `tests/unit/fe-xml.test.js` — `generateFeXml`: estaba al 9,55% de cobertura, sin un solo test. Cubre IVA 4%/13%/exento, descuentos, receptor opcional (cédula física/jurídica/DIMEX), contado vs crédito y notas de crédito.
- `tests/unit/booking-conflicts.test.js` — traslapes, bordes que se tocan sin conflicto, citas envolventes y ventana de consulta única.
- `tests/unit/financial-schemas.test.js` — ampliado con los schemas de B08.

Cobertura de dinero y FE: `xml.js` 96%, `match-payment.js` 96%, `booking-conflicts.js` 95%, `invoice-math.js` 94%, `financial-schemas.js` 100%, `fe/config.js` 80%. Se agregaron `fe/xml.js`, `financial-schemas.js` y `booking-conflicts.js` al `include` de cobertura en `vitest.config.js`.

---

## B05 — Revocación de sesiones (SEC-04) — ✅ YA ESTABA (verificado 15-jul-2026)
Añade `sessionVersion Int @default(0)` a User (migración Prisma). Inclúyelo al firmar el JWT. En operaciones sensibles (server actions de pagos, uploads, cambio de contraseña, todo `/api/admin`) compara el claim contra BD; si difiere → sesión inválida. Incrementa la versión al: cambiar contraseña, desactivar cuenta, revocar aprobación de profesional. El middleware NO consulta BD (edge): solo las rutas/actions.

**No se cambió nada: está implementado y, de hecho, es más estricto que lo que pedía el bloque.** En vez de comparar el claim solo en operaciones sensibles, `getSession` (`src/lib/auth.js:97`) contrasta `sessionVersion` e `isActive` contra la BD en **cada** request, envuelto en `cache()` de React para que las múltiples llamadas de un mismo request compartan una sola consulta. Migración `20260715160000_session_version` aplicada.

Verificado:
- El middleware solo importa `jwtVerify`; no toca Prisma (cumple la restricción de edge).
- Incrementos presentes en los tres disparadores: cambio de contraseña (`change-password`, `reset-password`), desactivación (`inactivate`, `rejectUser`) y revocación de aprobación (`professionals/[id]/reject`).
- `getSession` de `auth-actions.js` no es un segundo resolvedor: delega en el de `lib/auth`.
- Los `user.create` del registro no incrementan, y está bien: los usuarios nuevos arrancan en 0.
- `tests/unit/session-cache.test.js` ya cubre la revocación (bump de versión → sesión nula; `isActive: false` → sesión nula).

---

## B06 — Pasada de microcopy (UX-04) — ✅ HECHO (15-jul-2026)
Recorre los textos visibles de: registro, login, recuperación, agendamiento, panel del paciente y correos (`src/lib/*mail*.js`, `email-templates.js`). Corrige: tildes faltantes, frases robóticas por lenguaje claro y cálido de es-CR, consistencia de tuteo/voseo (elegir VOSEO y unificar), y mensajes de error accionables. Entrega un diff solo de strings: prohibido tocar lógica. Criterio: tabla antes/después en el resumen.

**Diff: 24 inserciones / 24 borrados en 10 archivos — solo strings, cero lógica.**

El problema de fondo no era la falta de tildes sino la **mezcla de registros dentro de un mismo mensaje**: el correo de verificación decía «Gracias por registrar**se**… us**á** el siguiente botón» (usted y voseo en dos líneas seguidas). Unificado todo a VOSEO.

| Antes | Después |
|---|---|
| «Si el correo existe, se enviará un enlace para restablecer la contraseña y continuar avanzando con acceso protegido.» | «Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva. Revisá tu bandeja y la carpeta de spam.» |
| «El enlace expiró o no es válido. Solicite uno nuevo para continuar avanzando con seguridad.» | «El enlace venció o ya se usó. Pedí uno nuevo desde «Olvidé mi contraseña».» |
| «Token faltante. Solicite un nuevo enlace…» | «El enlace está incompleto. Pedí uno nuevo desde «Olvidé mi contraseña».» |
| «La confirmación de contraseña no coincide.» | «Las dos contraseñas no coinciden. Revisalas e intentá de nuevo.» |
| «Gracias por registrarse en Salud Mental CR.» | «Gracias por registrarte en Salud Mental CR.» |
| «Se recibió una solicitud para restablecer la contraseña de su cuenta…» | «Recibimos una solicitud para restablecer la contraseña de tu cuenta…» |
| «Este enlace expirará pronto. Si esta solicitud no fue realizada, puede ignorar este mensaje con tranquilidad.» | «El enlace vence en 1 hora. Si no pediste el cambio, podés ignorar este mensaje: tu contraseña sigue igual.» |
| «Estimado/a {nombre}» + «Se registró una nueva solicitud de cita pendiente de aprobación.» | «Hola {nombre}» + «Tenés una nueva solicitud de cita esperando tu confirmación.» |
| «Excelente avance. Seleccione un nuevo horario… El proceso avanzara con estado Pendiente hasta la confirmacion profesional para cuidar una coordinacion segura.» | «Elegí un nuevo horario… Queda en estado Pendiente hasta que el profesional la confirme.» |
| «Hay un conflicto en {fecha}. Ajuste la serie e intentelo nuevamente para mantener una coordinacion segura.» | «Ese horario ya está ocupado el {fecha}. Ajustá la serie y probá de nuevo.» |
| «Verifique su correo (incluida la carpeta de spam).» | «Revisá tu correo, incluida la carpeta de spam.» |
| «Crear nueva contraseña de acceso seguro» | «Crear una contraseña nueva» |
| «Mínimo 8 caracteres para acceso protegido» | «Mínimo 8 caracteres» |
| «Ingrese su contraseña actual para continuar con la actualización segura.» | «Escribí tu contraseña actual para continuar.» |
| «Para proteger su cuenta y la información clínica, se solicita la contraseña actual antes de continuar.» | «Te pedimos la contraseña actual para proteger tu cuenta y tu información clínica.» |
| «El pago no pudo procesarse. Puede intentarlo nuevamente desde el panel para continuar.» | «No pudimos procesar el pago y no se te cobró nada. Podés intentarlo de nuevo desde tu panel.» |
| «El pago está siendo verificado. Se enviará una notificación cuando sea confirmado.» | «Estamos verificando el pago. Te avisamos por correo apenas se confirme.» |
| «Gracias por su compromiso profesional. Para continuar avanzando en su proceso, administración solicita agendar una reunión breve de coordinación.» | «Nos gustaría tener una reunión breve con vos para conocerte y coordinar los detalles de tu incorporación.» |

**Vigencia de los enlaces — ✅ CORREGIDA después (15-jul-2026), fuera del diff de strings.** El correo de verificación usaba una sola plantilla para dos vigencias (24 h al registrarse, 1 h al reenviar), así que el texto no podía decir el plazo y quedó en «vence pronto». La causa de fondo: la ruta grababa el token con un plazo y la plantilla lo desconocía, de modo que iban a divergir igual.

Ahora las constantes viven en `mail.js` junto a las plantillas que las prometen (`VERIFY_TOKEN_TTL_HOURS`, `VERIFY_RESEND_TTL_HOURS`, `RESET_TOKEN_TTL_HOURS`) con el helper `ttlToDate(horas)`, y **el mismo valor alimenta la expiración en BD y el texto del correo**: no pueden separarse. `sendVerificationEmail(email, token, horas)` recibe la vigencia y el texto dice «24 horas» o «1 hora» según corresponda, en singular o plural. Cubierto por `tests/unit/mail-ttl.test.js`.

Fuera de alcance: el árbol viejo `src/app/admin/*` y los paneles de admin (`AdminPostEditor`, `HomeCarouselManager`) también tienen tildes faltantes. No se tocaron porque B06 acota a las pantallas de paciente/profesional y correos.

---

## B07 — Extracción de duplicados (ARQ-03) — ✅ HECHO (15-jul-2026)
Extrae sin cambiar comportamiento: `findRecurringConflict` y helpers de fechas duplicados entre `booking-actions.js` y `patient-booking-actions.js` → `src/lib/booking-conflicts.js`; `computeLine`/`round2`/`toNumber` duplicados entre `api/invoices/route.js` y `api/invoices/[id]/route.js` → `src/lib/invoice-math.js`; `requireAdmin` repetido en rutas → `src/lib/api-guards.js`. Además: audita `src/app/admin/*` (árbol viejo) vs `/panel/admin/*` — si es legado sin enlaces entrantes, propone su eliminación (lista de archivos, sin borrar aún). Criterio: `npm test` idéntico antes/después; cero cambios de comportamiento.

**`booking-conflicts.js` existía pero era código muerto: nadie lo importaba.** Se había creado en una ola anterior sin migrar los llamadores, así que las tres copias de `findRecurringConflict` seguían vivas. Ahora el módulo tiene la consulta compartida y lo usan `booking-actions.js`, `patient-booking-actions.js` y `agenda-actions.js` (~110 líneas duplicadas menos). Cada caller conserva su formato de error propio vía un `describeRecurringConflict` local, porque los tres devuelven formas distintas (objeto con `label`/`dateString`, string, y `{ conflictStart }`).

`src/lib/api-guards.js` nuevo: las 9 copias de `requireAdmin` en rutas eran idénticas en comportamiento. También se unificó el chequeo inline equivalente de `api/invoices/route.js` (GET y POST) y se quitó el `toNumber`/`round2` duplicado de `api/invoices/[id]/pay/route.js`. `invoice-math.js` y los `requireAdmin` de server actions (`admin-actions`, `service-actions`, `settlement-actions`, `home-carousel-actions`) **no** se tocaron: esos tienen firmas distintas (lanzan excepción o devuelven booleano) y B07 acota el alcance a rutas.

### Auditoría del árbol viejo `src/app/admin/*` — ✅ ELIMINADO (15-jul-2026, autorizado)

8 archivos sin enlaces entrantes, sustituidos en su totalidad por `/panel/admin/*`. Borrados tras atender los cabos sueltos:

```
src/app/admin/page.js                        src/app/admin/professionals/page.js
src/app/admin/appointments/page.js           src/app/admin/professionals/[id]/page.js
src/app/admin/posts/page.js                  src/app/admin/professionals/pending/page.js
src/app/admin/posts/new/page.js              src/app/admin/users/page.js
```

Al ir a borrarlos apareció que los `revalidatePath` huérfanos eran **cuatro**, no uno, y que uno escondía un bug real:
- `agenda-actions.js` revalidaba `/admin/appointments` (muerta) y **no** `/panel/admin/citas`. La vista de citas del admin quedaba desactualizada tras cualquier cambio de agenda. Corregido.
- `approve`, `inactivate` y `reject` de profesionales revalidaban `/admin/professionals` además de `/panel/admin/personal`: la línea era redundante y se quitó.

`src/components/admin/*` **no** es legado: lo usa `/panel/*` y se conservó. La única excepción fue `CategorySelector.js`, que quedó huérfano porque su único consumidor era la página borrada `admin/professionals/[id]`; se eliminó también. El resto de los componentes que importaba el árbol viejo (`AdminAppointmentsManager`, `PendingProfessionalsList`, `AdminPostEditor`) los sigue usando el panel nuevo.

### Rutas sin autenticación eliminadas (15-jul-2026, autorizado)

`src/app/api/admin/professionals/posts/` tenía dos rutas **sin ningún control de sesión**, sin llamadores y rotas. Borradas:
- `route.js` — `GET` sin auth que devolvía posts con `include: { author: true }`, es decir el `ProfessionalProfile` completo… **incluido `googleRefreshToken`**. No filtraba porque filtraba por `status: 'PENDING'`, valor que no existe en el enum `PostStatus` (solo DRAFT/PUBLISHED/ARCHIVED), así que Prisma lanzaba y siempre devolvía 500. Lo único que separaba esa ruta de una fuga de credenciales OAuth era un valor de enum mal escrito.
- `[id]/approve/route.js` — `PATCH` sin auth que publicaba artículos; roto porque hacía `parseInt()` sobre un `id` que es cuid. Además instanciaba su propio `PrismaClient`.

---

## B08 — Validación con zod en endpoints financieros (ARQ-01) — ✅ HECHO (15-jul-2026)
~~`zod` es una dependencia dev-friendly sin costo: agrégala.~~ (Ya estaba: `zod@4.4.3`.) Define schemas para los bodies de `/api/invoices` (POST/PUT), `/api/invoices/[id]/*`, `/api/products`, y las server actions de settlement (T15) y billing (T13). Rechazos con 400 y mensaje de campo específico. No toques rutas no financieras todavía. Criterio: petición con `quantity: "abc"` devuelve 400 descriptivo, no 500 ni NaN persistido.

Las rutas (`/api/invoices`, `/api/products`) ya validaban con `financial-schemas.js` desde una ola anterior. Faltaban las server actions, que ahora usan los schemas nuevos: `settlementPeriodSchema`, `settlementInvoiceIdSchema`, `professionalInvoiceSchema` y `supplierAcceptanceSchema`.

Como las server actions no devuelven HTTP, el equivalente al «400 descriptivo» es `{ success: false, error }` con el mensaje del primer campo inválido (`firstIssueMessage`). Se conservaron los textos actuales para el usuario («El número de factura es obligatorio.», «Debes subir el XML firmado de la factura.», etc.) y su orden de precedencia.

**Trampa encontrada:** `z.coerce.date()` convierte `null` y `""` en la época de 1970 en vez de rechazarlos, y `formData.get()` devuelve `null` cuando el campo no viene — un período incompleto se habría liquidado como 1-ene-1970. El helper `isoDate` exige `Date` o string con contenido antes de coercer; hay test que lo cubre.

---

## B09 — Activar Storage privado (SEC-05) — ✅ HECHO (buckets privatizados el 15-jul-2026)
Buckets privados: `insurance-blank-forms`, `insurance-patient-forms`, `insurance-templates`, `insurance-signed-forms`, `CVS`, `professional-invoices`. Públicos: `avatars`, `service-banners`, `post-covers`.

**Migración de rutas: ✅ HECHA (15-jul-2026).** Se ejecutó `node --env-file=.env.local scripts/migrate-storage-paths.mjs --apply`. La ejecución actual detectó 0 cambios pendientes; las 4 referencias antiguas de `professionalProfile.cvUrl` ya habían sido normalizadas a `CVS/{userId}/cv.pdf`. El migrador ahora también cubre `insurance*Url`, `insuranceClaim.signedFormUrl`, `invoice.attachmentUrl/xmlUrl` y recupera adjuntos antiguos desde `Invoice.notes`.

**Pendiente residual:** verificar en producción que un CV antiguo abre vía `/api/files` (probar como ADMIN o como el profesional dueño). No se pudo verificar en local porque `SUPABASE_SERVICE_ROLE_KEY` está vacía en `.env.local` — sin ella `getSupabaseAdmin()` lanza y `/api/files` no puede firmar URLs. Si se rotó por T01, reponer el valor local desde el dashboard de Supabase.

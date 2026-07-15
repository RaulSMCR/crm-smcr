# Ola 5 — Backlog continuo (prompts cortos)

Estos son prompts abreviados para tareas de crecimiento y deuda técnica. Cuando toque ejecutar una, pedir a Claude que la expanda al formato completo de las tareas T01–T18 (contexto + reglas + pasos + criterios). Cada bloque entre `---` se puede pegar tal cual a Opus/Codex agregándole el bloque de contexto estándar.

## Bloque de contexto estándar (pegar al inicio de cada prompt)

> CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Tailwind, Prisma 5 + PostgreSQL (Supabase), auth propia JWT, pagos ONVO, correos Resend, jobs QStash. Reglas: no agregar servicios con costo; alcance quirúrgico (solo archivos de la tarea); textos es-CR con tildes; al terminar `npm run lint`, `npm test` y `npm run build` sin errores nuevos + lista de archivos cambiados y cómo probar.

---

## B01 — ISR en páginas públicas (MKT-01)
Las páginas públicas usan `force-dynamic`/`revalidate 0` y golpean la BD en cada visita. Cambia a ISR: home, `/servicios` y `/blog` con `revalidate = 300`; `/blog/[slug]` y `/profesionales/[slug]` con `revalidate = 3600`. Al publicar/editar/archivar un post o servicio (actions y rutas admin correspondientes), llama `revalidatePath()` de las rutas afectadas. Los paneles (`/panel/*`) siguen dinámicos. Verifica que ninguna página pública lea cookies/sesión en el server (eso rompería ISR): la home y el blog deben renderizar igual para todos. Criterio: segunda visita a la home no ejecuta consultas Prisma (verificar con logs).

---

## B02 — Sitemap con slugs y schemas de alto valor (MKT-02)
En `src/app/sitemap.js`: los profesionales deben apuntar a `/profesionales/{slug}` (hoy `/agendar/{id}`). Añade JSON-LD: `FAQPage` en `/faq` (con las preguntas reales de la página), `MedicalBusiness` (u `Organization` extendida con `medicalSpecialty`) en la home, `Service` con `Offer` (precio en CRC) en `/servicios/[id]`, y `BreadcrumbList` en blog y perfiles. Usa el componente `JsonLd` existente. Añade `alternates.canonical` en `/agendar/[id]` apuntando al perfil del profesional. Criterio: validar con el Rich Results Test de Google (pegar HTML renderizado).

---

## B03 — Dashboard de adquisición (MKT-04)
Todo se captura ya (`User.acquisitionChannel/campaignName`, `PostViewEvent` con UTM/scroll/tiempo) pero no se visualiza. Página `/panel/admin/marketing/adquisicion` (solo ADMIN): registros por canal/campaña por mes; embudo del período (visitas con anonId → registros → primera cita COMPLETED → paciente recurrente ≥2 citas); top 10 artículos por lecturas y por conversión a registro (join PostViewEvent.userId). Gráficos simples con tablas + barras CSS (sin librerías nuevas). Criterio: los números cuadran con consultas SQL de verificación incluidas en el resumen.

---

## B04 — Suite de tests base (ARQ-02)
Solo existen 2 archivos de test. Añade, en orden: (1) `invoice-math` y totales de factura con IVA 4%/13% y descuentos (si T09 ya existe, amplía); (2) clave numérica y consecutivo FE contra 3 ejemplos construidos a mano; (3) matcher del webhook (si T05 ya existe, amplía casos); (4) conflictos de agenda con recurrencias y límites de zona horaria (`src/lib/timezone.js`, `appointment-slots.js`). Nada de tests triviales de render. Criterio: `npm run test:coverage` muestra los módulos de dinero y FE por encima del 80%.

---

## B05 — Revocación de sesiones (SEC-04)
Añade `sessionVersion Int @default(0)` a User (migración Prisma). Inclúyelo al firmar el JWT. En operaciones sensibles (server actions de pagos, uploads, cambio de contraseña, todo `/api/admin`) compara el claim contra BD; si difiere → sesión inválida (401/redirect a /ingresar). Incrementa la versión al: cambiar contraseña, desactivar cuenta, revocar aprobación de profesional. El middleware NO consulta BD (edge): solo las rutas/actions. Criterio: desactivar un usuario invalida su sesión activa en la siguiente acción sensible.

---

## B06 — Pasada de microcopy (UX-04)
Recorre los textos visibles de: registro, login, recuperación, agendamiento, panel del paciente y correos (`src/lib/*mail*.js`, `email-templates.js`). Corrige: tildes faltantes («Redaccion», «pagina»), frases robóticas («…para mantener una coordinación segura», «…continuar avanzando con acceso protegido») por lenguaje claro y cálido de es-CR, consistencia de tuteo/voseo (elegir VOSEO y unificar), y mensajes de error accionables. Entrega un diff solo de strings: prohibido tocar lógica. Criterio: tabla antes/después en el resumen.

---

## B07 — Extracción de duplicados (ARQ-03)
Extrae sin cambiar comportamiento: `findRecurringConflict` y helpers de fechas duplicados entre `booking-actions.js` y `patient-booking-actions.js` → `src/lib/booking-conflicts.js`; `computeLine`/`round2`/`toNumber` duplicados entre `api/invoices/route.js` y `api/invoices/[id]/route.js` → `src/lib/invoice-math.js`; `requireAdmin` repetido en rutas → `src/lib/api-guards.js`. Además: audita `src/app/admin/*` (árbol viejo) vs `/panel/admin/*` — si es legado sin enlaces entrantes, propone su eliminación (lista de archivos, sin borrar aún). Criterio: `npm test` idéntico antes/después; cero cambios de comportamiento.

---

## B08 — Validación con zod en endpoints financieros (ARQ-01)
`zod` es una dependencia dev-friendly sin costo: agrégala. Define schemas para los bodies de `/api/invoices` (POST/PUT), `/api/invoices/[id]/*`, `/api/products`, y las server actions de settlement (T15) y billing (T13). Rechazos con 400 y mensaje de campo específico. No toques rutas no financieras todavía. Criterio: petición con `quantity: "abc"` devuelve 400 descriptivo, no 500 ni NaN persistido.

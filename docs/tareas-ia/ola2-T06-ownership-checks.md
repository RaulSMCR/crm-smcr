# T06 — Verificación de pertenencia en acciones con IDs (SEC-03)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL. Auth propia con JWT en cookie `session`; el payload incluye `userId`, `role` (USER | PROFESSIONAL | ADMIN) y `professionalProfileId`. Guards existentes en `src/lib/auth-guards.js`.

## Reglas duras
1. Alcance: solo los archivos de `src/actions/` y `src/app/api/upload/` listados; no toques UI.
2. Patrón consistente: comparar SIEMPRE contra el recurso cargado de la BD, nunca confiar en IDs que manda el cliente.
3. Mensajes de error en español, genéricos («No autorizado.») sin filtrar existencia de recursos ajenos.
4. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Problema
`cobrarCita(appointmentId)` en `src/actions/payment-actions.js` valida rol PROFESSIONAL/ADMIN pero nunca comprueba que la cita pertenezca al profesional de la sesión: cualquier profesional autenticado puede disparar cobros y correos sobre citas de colegas (IDOR). Hay que corregirla y auditar el mismo patrón en todas las server actions y rutas que reciben IDs.

## Pasos

1. En `cobrarCita`: tras cargar la cita, si `session.role === "PROFESSIONAL"`, exigir `appointment.professionalId === session.professionalProfileId` (usa `requireProfessionalProfileId()` de `src/lib/auth-guards.js` si el claim falta). ADMIN mantiene acceso total.
2. Audita archivo por archivo y aplica el mismo patrón donde falte (lee cada uno completo antes de decidir):
   - `src/actions/agenda-actions.js` — acciones del profesional sobre citas (completar, cancelar, reagendar): la cita debe ser suya.
   - `src/actions/availability-actions.js` — horarios: solo los propios.
   - `src/actions/patient-actions.js` y `src/actions/patient-booking-actions.js` — acciones del paciente: `appointment.patientId === session.userId`.
   - `src/actions/patient-profile-actions.js` — solo el propio perfil.
   - `src/actions/profile-actions.js` y `src/actions/service-actions.js` — verificar qué expone a PROFESSIONAL vs ADMIN.
   - `src/app/api/upload/insurance-template/route.js` — el profesional solo puede subir plantilla para pacientes que tengan cita con él.
   - `src/app/api/upload/insurance-signed-form/route.js` y demás uploads de seguros — verificar pertenencia paciente/profesional.
   - `src/app/api/professional/posts/[id]/route.js` — el post debe ser del autor.
3. Para cada archivo auditado, deja en tu resumen final una línea: `archivo — OK ya verificaba | CORREGIDO (qué faltaba)`.
4. Añade `tests/unit/ownership.test.js` con al menos 2 tests representativos (mock de Prisma y sesión): profesional A no puede `cobrarCita` de cita del profesional B; paciente A no puede cancelar cita del paciente B.

## Qué NO hacer
- No cambies flujos de negocio (estados de cita, correos) — solo agregar las verificaciones.
- No toques las rutas `/api/admin/*` (ya exigen ADMIN vía middleware + checks).
- No refactorices los guards existentes; extiéndelos si hace falta.

## Criterios de aceptación
- [ ] `cobrarCita` con sesión de profesional ajeno devuelve «No autorizado.» sin enviar correo ni crear transacción.
- [ ] Tabla de auditoría archivo-por-archivo en el resumen final.
- [ ] Tests nuevos pasan.

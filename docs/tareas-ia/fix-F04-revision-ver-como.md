# F04 — Auditoría del feature «ver como» (admin-view) — P2, solo revisión y endurecimiento

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), auth propia JWT. Fuera del plan de auditoría se agregó un modo de suplantación para el admin: `/api/auth/view-as` emite un token `admin_view` (cookie) con `purpose: "admin-view"`, rol USER o PROFESSIONAL y expiración 1 día; `getSession()` en `src/lib/auth.js` lo aplica si `view.sub === userId` y el rol real es ADMIN.

## Reglas duras
1. Primero AUDITA y reporta; solo aplica los endurecimientos listados si la auditoría confirma que faltan.
2. Alcance: `src/app/api/auth/view-as/route.js`, `src/lib/auth.js`, `src/app/api/auth/logout/route.js` y el punto de UI que lo activa.
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos.

## Checklist de auditoría (responder una por una en el resumen)
1. ¿`/api/auth/view-as` exige sesión ADMIN verificada contra BD (no solo el claim del JWT) antes de emitir el token?
2. ¿Se puede especificar QUÉ usuario suplantar, o solo el rol? Si suplanta usuarios concretos: ¿queda registrado (log/auditoría) quién, a quién y cuándo?
3. ¿El modo «ver como» permite ACCIONES de escritura como el usuario suplantado (pagar, cancelar citas, subir documentos), o solo lectura? Para un CRM de salud, debería ser solo lectura o excluir acciones financieras y de documentos médicos.
4. ¿Salir del modo (y el logout) elimina la cookie `admin_view` de forma fiable?
5. ¿La UI muestra un indicador visible y permanente de que se está en modo suplantación?
6. ¿El token de 1 día es revocable? (si el admin cierra sesión, ¿la cookie muere con él?)

## Endurecimientos a aplicar si faltan
- Registrar cada activación en un log persistente mínimo (modelo `AdminAuditLog` simple o `console.log` estructurado si aún no hay modelo — decidir según lo existente).
- Bloquear en modo «ver como» las server actions de pago, facturación y uploads (verificar `session.actualRole === "ADMIN"` y rechazar con mensaje claro).
- Reducir la expiración del token a 1 hora.
- Banner fijo «Estás viendo como {rol}» con botón «Salir del modo».

## Criterios de aceptación
- [x] Checklist respondido punto por punto con evidencia (archivo:línea).
- [x] Endurecimientos aplicados solo donde faltaban, con tests o pasos de verificación manual.

---

## Resultado de la auditoría (2026-07-15)

**Hallazgo estructural que enmarca todo lo demás:** «ver como» presta un ROL, no una
identidad. `signAdminViewToken(adminId, role)` fija `sub` = id del admin, y `getSession()`
solo sustituye `role`. El admin nunca ve datos de un paciente concreto: ve su propio panel
bajo otro rol. El riesgo real no es la lectura de expedientes ajenos, es la ESCRITURA:
crearía registros reales a nombre del admin.

| # | Pregunta | Respuesta | Evidencia |
|---|---|---|---|
| 1 | ¿ADMIN verificado contra BD? | **Sí.** Valida claim + `findUnique` con `role` e `isActive`. No revisa `sessionVersion`, pero la cookie de un admin revocado ya muere en `getSession()`, así que el token emitido sería inútil. | `view-as/route.js:32-39` |
| 2 | ¿Suplanta usuarios concretos? ¿Se registra? | **Solo rol, no usuario concreto** → no hay acceso a datos de terceros. **No había registro alguno** → corregido. | `auth.js:56-66` |
| 3 | ¿Permite escrituras? | **Sí, no había ninguna barrera** (`actualRole`/`isPreview` no se consultaban en ninguna acción). Mitigado de facto porque el admin carece de `professionalProfile` y las acciones de profesional fallaban cerradas — pero por accidente, no por diseño → corregido. | `payment-actions.js:38`, `professional-billing-actions.js:12` |
| 4 | ¿Salir y logout borran la cookie? | **Sí**, en las tres rutas. | `logout/route.js:24`, `auth-actions.js:460`, `view-as/route.js:50-54` |
| 5 | ¿Indicador visible? | **No.** Solo un `<select>` discreto en el header, indistinguible de un control normal → corregido con banner. | `PublicHeader.js:71-77` |
| 6 | ¿Revocable? | **Sí, indirectamente:** la cookie de vista solo se honra junto a una sesión ADMIN válida, y esa sí valida `sessionVersion`/`isActive` en cada request. Revocar al admin mata el modo vista. | `auth.js:101-121` |

### Endurecimientos aplicados
- **Log de auditoría**: `console.log` estructurado en JSON por cada activación y salida
  (`admin.view-as`: adminId, email, from, to, at). No se creó modelo `AdminAuditLog`: no
  existe nada equivalente en el schema y añadirlo pediría migración.
- **Bloqueo de escrituras** vía `isPreviewSession()` + `PREVIEW_BLOCKED_MESSAGE` (`auth.js`):
  `cobrarCita`, `sendPaymentLinkOnCompletion`, `submitProfessionalInvoice`, y los uploads
  `professional-invoice`, `insurance-signed-form`, `insurance-template`,
  `insurance-patient-form`. Las acciones ADMIN-only (fiscal, settlement, aceptación de
  facturas, `service-banner`, `insurance-blank-form`) ya eran inalcanzables en modo vista:
  el rol prestado no es ADMIN.
- **Expiración 1 día → 1 hora** (`ADMIN_VIEW_MAX_AGE_SECONDS`, token y cookie).
- **Banner ámbar fijo** «Estás viendo como {rol}» + botón «Salir del modo».

### Verificación
`tests/unit/admin-view-as.test.js` (7 casos: expiración, identidad conservada, cookie de
otro admin, rol real no-ADMIN, revocación por `sessionVersion`, rol forjado, no-preview).
`npm run lint` 0 errores · `npm test` 85/85 · `npm run build` OK.

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
- [ ] Checklist respondido punto por punto con evidencia (archivo:línea).
- [ ] Endurecimientos aplicados solo donde faltaban, con tests o pasos de verificación manual.

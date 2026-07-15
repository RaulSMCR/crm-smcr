# T07 — Documentos médicos en buckets privados con URLs firmadas (SEC-05) ⚠ requiere paso manual en Supabase

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL y Storage de Supabase (cliente admin con service_role en `src/lib/supabase-admin.js`). Roles: USER (paciente), PROFESSIONAL, ADMIN.

## Reglas duras
1. NO agregues dependencias. Todo con `@supabase/supabase-js` ya presente.
2. Si cambias `prisma/schema.prisma`, migración con `prisma migrate dev`.
3. Al terminar: `npm run lint`, `npm test`, `npm run build` sin errores nuevos + instrucciones del paso manual.

## Problema
Los uploads usan `getPublicUrl()`: cualquiera con la URL accede para siempre. Es aceptable para avatares y banners, pero NO para documentos con datos de salud: formularios de seguro (en blanco, del paciente, plantillas, firmados), CVs y facturas PDF de profesionales. Rutas: `src/app/api/upload/insurance-blank-form/`, `insurance-patient-form/`, `insurance-template/`, `insurance-signed-form/`, `cv/`, `professional-invoice/`.

## Pasos

1. Lee todas las rutas de `src/app/api/upload/*/route.js` y dónde se consumen las URLs (busca los campos `insurance*Url`, `cvUrl`, y la URL de factura guardada en `Invoice.notes`).
2. **Convención nueva:** en BD se guarda la RUTA de storage (`bucket/path`), no la URL pública. Documenta la convención en un comentario del helper.
3. Crea `src/lib/storage.js`:
   - `uploadPrivate(bucket, path, buffer, contentType)` — sube con el cliente admin.
   - `getSignedUrl(bucket, path, expiresInSeconds = 900)` — URL firmada de 15 min.
   - `validateFileSignature(buffer, allowedTypes)` — valida por **magic bytes** (no por `file.type` ni extensión): PDF `%PDF`, JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF....WEBP`. Rechaza lo demás.
4. Endpoint `src/app/api/files/route.js` (GET con `?path=bucket/ruta`): valida sesión y **pertenencia** antes de redirigir (302) a la URL firmada:
   - Paciente: solo sus propios documentos de seguro.
   - Profesional: plantillas/formularios de pacientes con los que tiene cita o reclamo (`InsuranceClaim`), y sus propios CV/facturas.
   - Admin: todo.
5. Aplica `validateFileSignature` en TODAS las rutas de upload (incluidas las públicas como avatar).
6. Actualiza los puntos de consumo (paneles, correos de seguros en `src/lib/insurance-mail.js`) para pasar por `/api/files?path=...`. En correos, el enlace apunta a `/api/files` (que exige sesión), nunca a una URL firmada de larga vida.
7. Migración de datos: script `scripts/migrate-storage-paths.mjs` que convierte las URLs públicas ya guardadas al formato ruta (extrae `bucket/path` del patrón `/storage/v1/object/public/{bucket}/{path}`). Ejecutar primero sin argumentos para simular y luego con `--apply` para escribir.
8. **Documenta el paso manual** (yo lo hago en el dashboard de Supabase): marcar como privados los buckets de seguros, CVs y facturas; avatares y banners quedan públicos. Lista los nombres exactos de los buckets encontrados en el código.

## Qué NO hacer
- No cambies avatares/banners a privado (rompería `next/image` y el rendimiento público).
- No borres archivos existentes en storage.
- No implementes antivirus ni procesamiento de imágenes (fuera de alcance).

## Criterios de aceptación
- [ ] Un documento de seguro recién subido NO es accesible por URL directa del bucket (tras el paso manual) y SÍ vía `/api/files` con la sesión correcta.
- [ ] Un paciente no puede acceder al documento de otro (403).
- [ ] Subir un `.pdf` renombrado que en realidad es `.exe` es rechazado (magic bytes).
- [ ] Script de migración de URLs entregado + instrucciones manuales claras.

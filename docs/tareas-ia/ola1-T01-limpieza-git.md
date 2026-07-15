# T01 — Limpieza de material sensible en git (SEC-02)

## Contexto del proyecto
CRM "Salud Mental Costa Rica": Next.js 14 App Router (JavaScript), Prisma 5 + PostgreSQL (Supabase), auth propia con JWT (cookie `session`, lib `jose`), pagos ONVO Pay, correos Resend, jobs Upstash QStash, facturación electrónica Hacienda CR en `src/lib/fe/`. Roles: USER (paciente), PROFESSIONAL, ADMIN.

## Reglas duras
1. NO introduzcas servicios ni dependencias nuevas con costo. Solo lo ya presente en `package.json`.
2. Alcance quirúrgico: toca solo lo indicado. Nada de refactors oportunistas.
3. Al terminar entrega: lista de archivos cambiados, explicación en 5 líneas, cómo verificar, y salida de `npm run lint` y `npm run build`.

## Problema
Están versionados en git archivos sensibles y basura: `cookies.txt` (cookie jar de curl con posibles tokens de sesión válidos), `dev.combined.log`, `dev.err.log`, `dev.out.log`, `dev.npm-version.log`, `dev.test.log`, `build-output.txt`, documentos internos `*.docx` (raíz, `Articulos/`, `carruseles/`) y temporales de Word (`~$*.docx`).

## Pasos

1. Añade al `.gitignore`:
   ```
   cookies.txt
   dev.*.log
   build-output.txt
   *.docx
   ~$*
   ```
2. Sácalos del índice sin borrarlos del disco: `git rm --cached` para cada patrón anterior (los .docx son material de trabajo del dueño; deben seguir existiendo localmente).
3. Commit: `T01: retirar material sensible y temporal del control de versiones (SEC-02)`.
4. Purga el historial con `git filter-repo` (herramienta gratuita) para eliminar esos archivos de TODOS los commits anteriores — especialmente `cookies.txt` y los `dev.*.log`. Si `git-filter-repo` no está instalado, indícalo y dame el comando exacto de instalación y de ejecución en Windows para que lo corra yo.
5. ANTES de forzar push a cualquier remoto, DETENTE y avísame: la reescritura de historial invalida clones existentes.
6. Genera un archivo `docs/tareas-ia/T01-rotacion-manual.md` con la lista de secretos que YO debo rotar a mano porque pudieron quedar expuestos en logs/historial: `SESSION_SECRET`, `ONVO_WEBHOOK_SECRET`, `ONVO_SECRET_KEY`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (password), credenciales FE (`FE_USERNAME`, `FE_PASSWORD`, `FE_P12_PIN`) y tokens de Google OAuth — con dónde se rota cada uno (dashboard correspondiente) y en qué variable de entorno vive.

## Qué NO hacer
- No borres los archivos del disco (solo del control de versiones).
- No hagas push forzado sin mi confirmación explícita.
- No toques código de la aplicación.

## Criterios de aceptación
- [ ] `git ls-files | grep -iE "cookies.txt|dev\..*log|docx|build-output"` no devuelve nada.
- [ ] Los archivos siguen existiendo en el disco.
- [ ] `docs/tareas-ia/T01-rotacion-manual.md` existe con la tabla de secretos.
- [ ] El historial purgado está preparado pero SIN push forzado (esperando mi confirmación).

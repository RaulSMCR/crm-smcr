# AGENTS.md

## Estado verificado

- Rama principal: `main`.
- Node declarado: `24.x`; instalación verificada: `24.15.0`.
- Next.js declarado y resuelto: `16.2.10`.
- Prisma y `@prisma/client`: `5.22.0`.
- React: `18.2.0`.
- Base de datos: PostgreSQL mediante Prisma, con Supabase.
- Despliegue: Vercel.
- Funciones Python de slides: `api/slides/**`.
- No existe `.nvmrc`.
- No existe script `typecheck`.
- No hay archivos TypeScript verificados.

## Package manager

La política de trabajo es usar `pnpm` obligatoriamente:

```bash
pnpm install
pnpm run dev
pnpm run lint
pnpm test
pnpm run build
```

Estado actual verificado: existe `package-lock.json`, no existe `pnpm-lock.yaml` y `package.json` no declara `packageManager`. La migración formal a pnpm requiere aprobación separada. No eliminar ni regenerar lockfiles como parte de otra tarea.

## Comandos

```bash
pnpm run dev
pnpm run build
pnpm run lint
pnpm test
pnpm test -- --coverage
pnpm run migrate
pnpm run db:push
pnpm run db:seed
pnpm run db:studio
```

Typecheck: no disponible actualmente. No inventar un comando ni añadir TypeScript solo para crear un typecheck.

## Estructura relevante

- `src/app/`: App Router y endpoints.
- `src/components/`: componentes de interfaz.
- `src/actions/`: server actions.
- `src/lib/`: lógica compartida, validación, acceso y Storage.
- `prisma/schema.prisma`: schema Prisma vigente.
- `prisma/migrations/`: migraciones existentes.
- `api/slides/`: renderer Python y funciones Vercel.
- `vendor/`: documentación y materiales editoriales históricos.
- `mcp/`: integración experimental.
- `tests/`: pruebas unitarias e integración.
- `vercel.json`: configuración de Vercel y funciones Python.

## Prisma y migraciones

- Leer siempre `prisma/schema.prisma` antes de modificar consultas, modelos o relaciones.
- Verificar nombres, tipos, enums y relaciones contra el schema vigente.
- No usar `db:push`, `migrate` ni crear migraciones sin aprobación explícita.
- Toda modificación de schema debe incluir una migración revisable.
- Preferir migraciones aditivas y preservar datos existentes.
- No eliminar columnas, tablas o enums sin aprobación explícita.
- No modificar la base de datos real durante pruebas locales sin autorización.

## Seguridad

- No exponer secretos, tokens, cookies ni valores de variables de entorno.
- No incluir secretos en código, respuestas HTTP, errores, logs ni documentación.
- Mantener las claves de Supabase y Storage del lado servidor.
- Usar URLs firmadas para archivos privados.
- Validar autenticación, autorización, ownership, MIME, tamaño y contenido de archivos.
- No confiar solamente en validaciones del navegador.
- No registrar artículos completos, prompts, tokens ni credenciales.
- Mantener separadas las autenticaciones de navegador y de integraciones externas.

## Modelos de IA

- No introducir llamadas a OpenAI, Anthropic ni otro proveedor sin aprobación explícita.
- No añadir SDKs, endpoints, variables de entorno ni automatizaciones de modelos sin aprobación.
- El Modo A editorial funciona mediante exportación e importación manual de archivos.
- El CRM no genera artículos, slides ni imágenes mediante APIs de modelos.
- No reutilizar ni ampliar el endpoint Anthropic existente sin aprobación específica.
- No introducir MCP, Actions o automatización del navegador como dependencia del flujo principal.

## Dependencias y cambios

- No añadir dependencias de producción sin aprobación explícita.
- Preferir utilidades y dependencias ya presentes.
- Trabajar en cambios pequeños y revisables.
- No modificar áreas no relacionadas.
- Preservar las superficies administrativas y profesionales existentes.
- Mantener compatibilidad con Vercel, Supabase, Prisma y el renderer Python.

## Módulo editorial

- El manifiesto editorial gobierna rigor, evidencia, voz y estructura del contenido.
- La identidad visual gobierna composición, paleta, tipografía, logo y tratamiento gráfico.
- No mezclar reglas editoriales y visuales sin indicar su procedencia.
- Usar versionado inmutable para specs, slides, textos, assets y estados de aprobación.
- Importar con validación y vista previa de diferencias.
- No escribir en la base de datos antes de la confirmación explícita.
- No sobrescribir silenciosamente contenido aprobado.
- Editar texto sin regenerar imágenes cuando el asset no cambió.
- Reemplazar una imagen solamente en la slide seleccionada.
- No regenerar ni eliminar assets de otras slides.
- Conservar versiones anteriores y permitir restauración.
- Mantener `src/lib/carousel-spec.js` como referencia del contrato vigente hasta aprobar un reemplazo.
- Usar el renderer existente como renderizado determinista, no como generación mediante IA.

## Criterio de terminado

Una tarea está terminada cuando:

- cumple exactamente el alcance aprobado;
- no modifica áreas ajenas;
- conserva compatibilidad con Vercel y Supabase;
- Prisma y migraciones fueron revisados, si aplican;
- se ejecutaron `pnpm run lint`, `pnpm test` y `pnpm run build`;
- se informó que typecheck no está disponible, si continúa sin script;
- se verificó que no se añadieron llamadas ni dependencias de modelos;
- no se expusieron secretos;
- se documentaron riesgos y pruebas no ejecutables;
- el diff es pequeño, revisable y reversible.

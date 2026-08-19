# S0 · Preparación y arnés de verificación

**Estado:** ejecutado el 2026-08-19. Rama `fix/seo-geo`.
**Riesgo:** nulo. Ningún cambio en código de aplicación, ninguna escritura en la base.

---

## Qué se hizo

| # | Paso del plan | Resultado |
|---|---|---|
| 1 | Rama `fix/seo-geo` | creada desde `main` (`4e0b123`) |
| 2 | `docs/planes/` | creado |
| 3 | Respaldo de `Post`, `ProfessionalProfile`, `Service`, `User` | `docs/backups/pre-seo-2026-08-19.json` — **desviación, ver abajo** |
| 4 | Inventario de URLs públicas | `docs/backups/urls-produccion-2026-08-19.txt` — 40 URLs |
| 5 | `scripts/verify-seo.mjs` | creado, sin dependencias nuevas |
| 6 | Baseline técnico | `docs/backups/baseline-tecnico-2026-08-19.json` — 40 entradas |

Archivos nuevos versionados: `scripts/seo-baseline-dump.mjs`, `scripts/verify-seo.mjs`, este documento, y una regla en `.gitignore`.

---

## Desviaciones respecto del plan

### El respaldo es JSON, no SQL

El plan pedía `pre-seo-{fecha}.sql`. **No hay `pg_dump` en este entorno**, y no se instaló nada para conseguirlo: el proyecto no tiene gastos fijos ni herramientas de sistema que no vengan con Node.

El respaldo se genera con Prisma (`scripts/seo-baseline-dump.mjs`) y guarda las filas completas en JSON. Cumple la misma función —restaurar un slug perdido— y tiene una ventaja para lo que viene: el `--revert` de S4 puede leerlo directo, sin parsear SQL.

Lo que **no** cumple es restaurar la base entera ante un desastre. Para eso está el respaldo automático de Supabase, que es el que corresponde y no depende de este repositorio.

### `docs/backups/` no se versiona

El plan no lo previó y es un problema real: el respaldo lleva nombres, correos y biografías del equipo, y el repositorio tiene remoto en GitHub. Se agregó `docs/backups/` a `.gitignore`.

Consecuencia práctica: **los archivos de S0 viven solo en esta máquina.** Antes de ejecutar S4, S5 o S6 hay que verificar que siguen ahí, o regenerarlos con `node scripts/seo-baseline-dump.mjs`.

### De `User` se guarda un subconjunto de columnas

Solo `id`, `name`, `email`, `role`, `isActive`, `createdAt`, y solo de `ADMIN` y `PROFESSIONAL` (6 filas). El hash de contraseña y los datos de las personas usuarias no tienen por qué salir de la base para un trabajo de SEO. Lo que la cadena S5 necesita de `User` es el nombre, que es de donde sale el slug del perfil.

---

## Baseline: el estado real al 2026-08-19

40 URLs públicas · 32 sin observaciones · 8 con observaciones.

| Recuento | Valor |
|---|---|
| HTTP 4xx/5xx | 1 |
| redirecciones | 0 |
| canónico apuntando a otra URL | 7 |
| sin canónico | 0 |
| sin JSON-LD | 0 |
| sin meta description | 0 |

### Contraste con la auditoría

| Hallazgo | Lo que decía la auditoría | Lo que se verificó hoy |
|---|---|---|
| H-02 | 7 slugs de artículo mutilados | **7, confirmados uno por uno** |
| H-03 | `ral-olmedo` | confirmado |
| H-01 | 4 páginas legales con canónico a la home | confirmado, y **son 7 URLs en total**: las 4 legales (`/faq`, `/terminos`, `/privacidad`, `/cookies`) más las 3 de `/registro`. La auditoría contó solo las legales; el arnés cuenta todo lo que hereda |
| H-08 | perfil inactivo en el sitemap | confirmado: `/profesionales/mariano-zorrilla` está en el sitemap y **devuelve 404 en producción** |
| H-30 | sufijo de colisión aleatorio | confirmado: `la-salud-mental-no-cabe-en-una-sola-disciplina-8oyy6` |
| H-32 | `lang` genérico | confirmado: las 40 URLs declaran `lang="es"` |

### Hallazgo nuevo, no registrado en la auditoría

**`https://saludmentalcostarica.com/og-image.png` devuelve 404.** No es que falte una imagen mejor: la que el layout declara en `og:image` y en `twitter:image` no existe, ni en `public/` ni en producción. Cada vez que alguien comparte cualquier página del sitio en WhatsApp, Instagram, Facebook o LinkedIn, la vista previa sale rota.

La auditoría clasificó H-05 como si fuera una mejora de identidad de marca. Es una URL rota en el elemento más visible que tiene el sitio fuera del sitio. Sigue bloqueado por D1 —hay que decidir qué muestra la imagen—, pero la urgencia es otra.

Los 7 slugs mutilados, en el estado en que están hoy:

```
del-alma-atribulada-a-la-salud-mental-un-itinerario-geneal-gico-introducci-n
l-gicas-comunes-m-s-all-de-la-dicotom-a-salud-enfermedad
qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-2
qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-3
qu-es-psicoterapia-y-c-mo-orientarse-entre-escuelas-parte-4
autoayuda-pop-y-psic-logo-influencer
autoayuda-pop-y-psic-logo-influencer-parte-ii
```

Los tres primeros artículos del capítulo 1 al 4 y los dos de «Del alma atribulada» ya tienen slug limpio: no se tocan en S4.

---

## Cómo se usa el arnés

```bash
# Regenerar respaldo e inventario desde producción
node scripts/seo-baseline-dump.mjs

# Informe legible
node scripts/verify-seo.mjs docs/backups/urls-produccion-2026-08-19.txt

# Guardar un baseline nuevo
node scripts/verify-seo.mjs docs/backups/urls-produccion-2026-08-19.txt \
  --out docs/backups/baseline-tecnico-2026-08-19.json

# Comparar el estado actual contra un baseline anterior: es la verificación
# de cierre de cada segmento
node scripts/verify-seo.mjs docs/backups/urls-produccion-2026-08-19.txt \
  --diff docs/backups/baseline-tecnico-2026-08-19.json

# Contra el servidor local, antes de desplegar
node scripts/verify-seo.mjs docs/backups/urls-produccion-2026-08-19.txt \
  --base http://localhost:3000
```

`verify-seo.mjs` no sigue redirecciones a propósito (`redirect: 'manual'`). Es lo que permite que S4 verifique el 301 de cada slug viejo: con `follow` todo devolvería 200 y no se vería nada.

---

## Lo que NO se tocó

Ningún archivo de `src/`. Ninguna escritura en la base. El `.gitignore` se modificó solo para agregar `docs/backups/`.

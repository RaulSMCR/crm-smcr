# S6 · Slugs de servicio ⚠

**Estado:** ejecutado el 2026-08-20.
**Hallazgo:** H-25.
**Riesgo:** medio. Cambia la forma de diez URLs públicas y toca ocho archivos.

---

## 1. D4, decidida: la ruta pasa a `[slug]`

Las dos opciones eran renombrar el segmento o mantener `[id]` y resolver por slug
con fallback al cuid.

**Gana renombrar**, y la razón es que S2 ya volvió innecesaria la alternativa. Un
cuid que llega a `/servicios/[slug]` falla la búsqueda por slug y cae en la tabla
de redirects, que lo manda al destino con un 308 — el mismo camino que ya usan
los artículos y los perfiles. **No hace falta ninguna rama de compatibilidad.**

Mantener `[id]` habría dejado dos cosas para siempre: un parámetro llamado `id`
que contiene un slug, y una rama de fallback que nadie se anima a borrar. El
costo de renombrar es de una vez y es mecánico.

---

## 2. Los diez slugs

Sin colisiones y sin necesidad de ajuste editorial: los nombres son cortos y
estables.

| Servicio | Slug |
|---|---|
| Psicoterapia psicoanalítica (adultos) | `psicoterapia-psicoanalitica-adultos` |
| Nutrición | `nutricion` |
| Psicoterapia Cognitivo Conductual | `psicoterapia-cognitivo-conductual` |
| Terapia física y deporte | `terapia-fisica-y-deporte` |
| Musicoterapia | `musicoterapia` |
| Psiquiatría | `psiquiatria` |
| Equipo de acompañamiento terapéutico | `equipo-de-acompanamiento-terapeutico` |
| Pedagogía | `pedagogia` |
| Terapia de Lenguaje | `terapia-de-lenguaje` |
| Psicodiagnóstico | `psicodiagnostico` |

---

## 3. La migración de esquema fue en dos pasos

`20260820010000_service_slug` agrega la columna **nullable** con su índice único.
`scripts/migrate-service-slugs.mjs` escribe los valores.
`20260820020000_service_slug_required` la pone `NOT NULL`.

En un solo paso habría hecho falta transliterar acentos en SQL, lo que depende de
la extensión `unaccent` y no está garantizada en el proyecto. Entre los dos pasos,
el campo del schema estuvo momentáneamente como `String?` para poder poblarlo con
el cliente tipado; quedó en `String` al terminar.

---

## 4. Los ocho archivos que tocó el renombre

| Archivo | Qué cambió |
|---|---|
| `src/app/servicios/[id]/` → `[slug]/` | la carpeta y los `params` |
| `src/app/servicios/page.js` | el `href` del listado, y `slug` en el `select` |
| `src/app/page.js` | la home pasaba `slug: service.id` a las tarjetas |
| `src/app/sitemap.js` | la URL y el `select` |
| `src/app/panel/paciente/agendar/page.js` | dos enlaces al servicio |
| `src/app/panel/admin/marketing/seo/page.js` | el `publicHref` del panel |
| `src/actions/service-actions.js` | tres `revalidatePath` |
| `prisma/schema.prisma` | el campo |

### Los `revalidatePath` habrían fallado en silencio

Tres llamadas revalidaban `/servicios/${serviceId}`, que con la ruta renombrada
ya no es un path existente: no habrían dado error, simplemente no habrían
revalidado nada, y el servicio editado habría seguido mostrando datos viejos
hasta que expirara el ISR. Ahora usan `revalidatePath('/servicios/[slug]', 'page')`,
que revalida todas las páginas de la ruta dinámica sin necesitar una consulta
extra para averiguar el slug.

Los componentes `CategoryCard`, `CategorySection` y `ServiceCard` ya recibían el
valor por una prop llamada `slug`; lo que estaba mal era quién se la pasaba.

---

## 5. Verificación

| Criterio | Resultado |
|---|---|
| `/servicios/{slug}` responde 200 | 10/10 |
| `/servicios/{cuid}` redirige al slug correcto | **10/10 → 308** |
| Un slug inventado sigue en 404 | cumplido |
| El sitemap usa los slugs nuevos | 10/10 |
| El listado y la home enlazan por slug | cumplido |
| Suite completa | 671 tests en verde |
| Build | limpio, la ruta figura como `ƒ /servicios/[slug]` |

---

## 6. Rollback

```bash
node scripts/migrate-service-slugs.mjs --revert --commit
```

Vacía la columna y borra los redirects. **Requiere deshacer antes la migración
`_required`**, porque la columna es `NOT NULL`.

# S5 · Slugs de profesional ⚠

**Estado:** ejecutado el 2026-08-20.
**Hallazgo:** H-03.
**Riesgo:** alto en teoría, bajo en la práctica: un solo perfil cambió.

---

## 1. El bug era distinto al de los artículos

`src/actions/auth-actions.js:301` armaba el slug así:

```js
name.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-")
```

`\w` sin flag `u` es `[A-Za-z0-9_]`. La letra acentuada no coincide con la clase
negada, así que **se borraba**. No se convertía en guión como en los artículos:
desaparecía.

| Nombre | Slug viejo | Slug nuevo |
|---|---|---|
| Raúl Olmedo | `ral-olmedo` | `raul-olmedo` |
| María Muñoz Peña | `mara-muoz-pea` | `maria-munoz-pena` |
| José Ángel Gutiérrez | `jos-ngel-gutirrez` | `jose-angel-gutierrez` |
| Ñuño Íñiguez | `uo-iguez` | `nuno-iniguez` |
| François Dupont | `franois-dupont` | `francois-dupont` |

Solo el primero existe en la base; los otros cuatro son la comprobación de que
el generador arreglado hace lo correcto, y quedaron como test de regresión.

**Por eso acá no hizo falta detectar la firma del bug como en S4.** El nombre de
la persona es la fuente de verdad y son cuatro perfiles: se compara contra
`slugify(nombre)` y listo.

---

## 2. Lo que se hizo

1. **`auth-actions.js` usa `slugUnico`** de S3. De paso desaparece el bucle de
   colisión propio, que empezaba en `-1` en vez de `-2` y no era consistente con
   el resto.
2. **Migración de `ral-olmedo` a `raul-olmedo`**, con su redirect, en una
   transacción. Los otros tres perfiles ya estaban bien.
3. **`/blog?autor=` resuelve slugs viejos.** Ver abajo.

### El filtro por autor quedaba en blanco

Después de migrar, `/blog?autor=ral-olmedo` devolvía **200 con la lista vacía**:
una página en blanco sin explicación. Los tres lugares que arman ese enlace
(`HomeFeatureCarousel`, `ProfessionalProfileCard`) lo construyen desde
`professional.slug`, así que ningún enlace vivo apunta ahí — pero un enlace
compartido o guardado sí, y `?autor=ral-olmedo` es una URL que existe en el
mundo.

`src/app/blog/page.js` ahora, cuando el `autor` no corresponde a ningún perfil,
lo busca en la tabla de redirects y emite un 308 preservando el resto de los
filtros con `libraryHref`. Un autor inventado sigue dando 200 con lista vacía,
que es lo correcto: no hay nada a donde mandarlo.

**Esto excede la letra del plan**, que solo pedía verificar que el filtro
siguiera funcionando. Se hizo igual porque la premisa del segmento es no perder
URLs, y esa era una URL que se perdía en silencio.

---

## 3. Verificación

| Criterio | Resultado |
|---|---|
| `/profesionales/raul-olmedo` | **200** |
| `/profesionales/ral-olmedo` | **308** → `/profesionales/raul-olmedo` |
| `/blog?autor=raul-olmedo` | 200, **15 artículos** |
| `/blog?autor=ral-olmedo` | **308** → `/blog?autor=raul-olmedo` |
| `/blog?autor=inventado` | 200 con lista vacía, sin redirigir |
| Suite completa | 671 tests en verde |
| Build | limpio |

---

## 4. Rollback

```bash
node scripts/migrate-professional-slugs.mjs --revert docs/backups/pre-seo-2026-08-20.json --commit
```

---

## 5. Lo que NO se tocó

El registro con nombre acentuado **no se probó de punta a punta contra la base**:
crear un profesional de prueba en producción implica un usuario real en una base
sin respaldo restaurable. La función que genera el slug está cubierta por tests
con cinco nombres acentuados, que es donde estaba el bug.

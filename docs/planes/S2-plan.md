# S2 · Infraestructura de redirects ⚠

**Estado:** aprobado e implementado el 2026-08-19. Ver §7.
**Rama:** `fix/seo-geo` (sobre `257896a`).
**Hallazgo:** H-04.
**Riesgo:** medio. Agrega una tabla; no toca ningún slug.

**Ningún slug se toca en este segmento.** S2 construye el mecanismo que hace posibles S4, S5 y S6.

---

## 1. D2, resuelta: tabla `SlugRedirect`

El plan pedía argumentar la elección, no darla por hecha. Las dos opciones eran una tabla única o un campo `slugHistory String[]` en cada entidad.

**Gana la tabla, por cuatro razones concretas de este proyecto:**

**Un slug puede migrar dos veces.** Es el caso que decide. Con `slugHistory[]`, si `ral-olmedo` pasa a `raul-olmedo` y más adelante a `raul-olmedo-psicologo`, hay que acordarse de arrastrar el histórico completo en cada migración; olvidarlo rompe la primera URL en silencio y nadie se entera hasta que alguien reporta un 404. Con la tabla, cada salto es una fila y la resolución encuentra el destino vigente sin depender de que el arreglo se haya mantenido bien.

**La lógica vive en un solo lugar.** Tres entidades por el campo significan tres implementaciones de la misma consulta, en tres archivos, que hay que mantener sincronizadas. La tabla necesita un helper y ya.

**Se consulta solo en el camino del 404.** Ninguna de las dos opciones se consulta en el middleware —eso sería una consulta a la base en cada request del sitio—. Pero con `slugHistory[]` la tentación es incluir el campo en el `select` de la ruta, que lo agrega al costo de todas las URLs que sí funcionan. La tabla no ofrece esa tentación: se llega a ella solo cuando la consulta principal ya devolvió vacío.

**El histórico es dato de infraestructura, no de contenido.** Un `Post` no tiene por qué llevar encima la lista de URLs que tuvo. Mezclarlo con el contenido editorial ensucia el modelo y aparece en cada `select *` del panel.

Lo que cuesta: una tabla más y un índice. Aceptable.

---

## 2. Modelo

```prisma
model SlugRedirect {
  id         String   @id @default(cuid())
  entityType String   // 'post' | 'professional' | 'service'
  fromSlug   String
  toSlug     String
  createdAt  DateTime @default(now())

  @@unique([entityType, fromSlug])
  @@index([entityType, toSlug])
}
```

`@@unique([entityType, fromSlug])` es la garantía central: un slug viejo no puede apuntar a dos destinos. Si una migración intentara registrar un origen duplicado, la base lo rechaza en vez de dejar un redirect ambiguo.

`@@index([entityType, toSlug])` sirve al encadenamiento —encontrar qué apuntaba a un slug que a su vez migró— y al `--revert` de S4.

`entityType` es texto y no enum de Prisma a propósito: un enum obliga a una migración de tipo cada vez que se agregue una entidad, y acá el conjunto de valores lo valida el helper, que es el único que escribe.

---

## 3. Migración ⚠

Por el SQL Editor de Supabase, según la regla permanente del proyecto. **Nunca `prisma migrate deploy` en el build.**

```sql
CREATE TABLE public."SlugRedirect" (
    id          TEXT PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "fromSlug"   TEXT NOT NULL,
    "toSlug"     TEXT NOT NULL,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un slug viejo no puede apuntar a dos destinos.
CREATE UNIQUE INDEX "SlugRedirect_entityType_fromSlug_key"
    ON public."SlugRedirect" ("entityType", "fromSlug");

-- Para encadenar saltos y para el --revert de S4.
CREATE INDEX "SlugRedirect_entityType_toSlug_idx"
    ON public."SlugRedirect" ("entityType", "toSlug");
```

Después, en local:

```bash
npx prisma migrate resolve --applied <nombre_de_la_migracion>
npx prisma generate
```

La tabla es **aditiva**: no altera ni borra nada, así que no requiere el backup previo de la regla 3. El de S0 sigue vigente igual.

---

## 4. El código se despliega antes que la tabla, y no puede romper nada

Esta es la decisión de implementación que más importa, porque el orden real de los hechos es: primero se mergea el código, después Raúl corre el SQL. Entre esos dos momentos, `prisma.slugRedirect.findFirst` falla porque la tabla no existe.

Si ese fallo se propagara, **todo 404 del sitio se convertiría en un 500**: la consulta de redirect vive justo en el camino donde la entidad no se encontró. Sería cambiar un problema chico por uno grande.

Por eso `resolveRedirect` atrapa cualquier error, lo registra y devuelve `null`. Un redirect que no se puede resolver degrada a 404, que es exactamente lo que pasaba antes de S2. **La ausencia de la tabla es indistinguible de la ausencia de un redirect**, y eso es lo correcto.

---

## 5. Archivos

### Se crea

| Archivo | Para qué |
|---|---|
| `src/lib/slug-redirect.js` | `resolveRedirect(entityType, slug)` y `registrarRedirect(...)` |
| `tests/unit/slug-redirect.test.js` | fija la degradación a `null` y la normalización |

### Se modifican

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | modelo `SlugRedirect` |
| `src/app/blog/[slug]/page.js` | antes de `notFound()`, buscar redirect y emitir 301 |
| `src/app/profesionales/[slug]/page.js` | ídem |
| `src/app/servicios/[id]/page.js` | ídem |

### No se toca

Ningún slug. `src/middleware.js` —la resolución va en la página, no en el middleware, para no pagar una consulta a la base en cada request—. Ninguna implementación de `slugify`: eso es S3.

---

## 6. Verificación

| Criterio | Cómo |
|---|---|
| Un slug inexistente **sin** redirect sigue devolviendo 404 | arnés: `/profesionales/mariano-zorrilla` sigue en 404 |
| Sin la tabla creada, nada se rompe | build y arnés con el código mergeado y la tabla ausente |
| Un slug con redirect registrado devuelve **301** al destino | prueba manual: insertar fila, `curl -I`, borrarla |
| Las URLs que ya funcionan no cambian ni suman latencia | arnés 39/40, comparado contra el baseline |

---

## 7. Resultado real

Implementado y verificado el 2026-08-19 **con la tabla todavía ausente en producción**, que es el estado en que el código se despliega.

- Build limpio, suite completa en verde.
- Arnés: 39/40, sin cambios respecto de S1. Ninguna URL existente cambió de comportamiento.
- `/profesionales/mariano-zorrilla` y `/blog/inventado-que-no-existe` siguen devolviendo **404**, no 500: la degradación de §4 funciona.
### Cierre: la tabla existe y el redirect funciona

La tabla se creó el 2026-08-19, durante la recuperación del incidente de pérdida de datos (ver abajo). Verificación completa contra producción:

1. Se insertó `post: prueba-301-borrar → que-es-psicoterapia-y-como-orientarse-entre-escuelas`.
2. `/blog/prueba-301-borrar` respondió **308 Permanent Redirect** con `Location` al destino correcto.
3. Se borró la fila. La misma URL volvió a **404**.

**Corrección al plan: es 308, no 301.** El plan decía «emitir `permanentRedirect()` (301)». `permanentRedirect()` de Next emite **308**, y no hay forma de pedirle 301 desde un Server Component. Para SEO da igual —Google documenta que trata 308 igual que 301—, y 308 además preserva el método HTTP, que es más correcto. Pero el número del plan estaba mal y conviene que quede escrito, porque la verificación de S4 va a comparar contra lo que diga acá.

**S4 queda desbloqueado.**

### Nota sobre cómo se creó la tabla

No se creó siguiendo estos pasos. El `migration.sql` de `20260819120000_add_slug_redirect` se commiteó vacío (0 bytes) y quedó registrado como aplicado sin haber creado nada; en el intento de resolverlo se corrió un comando que reaplicó las 65 migraciones desde cero y **vació la base de producción**. La tabla terminó creándose durante esa recuperación.

La lección, que vale para S4, S5 y S6: **`prisma migrate dev` y `prisma migrate reset` no se corren nunca contra producción.** La regla del proyecto de que los cambios de esquema van por el SQL Editor existe exactamente por esto, y este plan la había repetido sin nombrar el comando peligroso.

# Hallazgos nuevos — plan SEO/GEO

Cosas que aparecieron durante la ejecución del plan y que **no** están en `docs/auditoria-seo-geo.md`.

| # | Hallazgo | Estado |
|---|---|---|
| HN-01 | `/og-image.png` devuelve 404 en producción | **abierto** — bloqueado por D1 |
| HN-02 | La home y `/servicios` hornean su estado degradado en el build | **reparado** el 2026-08-19 |
| HN-03 | El arnés se autoflagelaba contra el servidor local | **reparado** el 2026-08-19 |
| HN-04 | `/panel/admin/tareas` ya existe | **abierto** — a resolver al empezar S16 |

---

## HN-01 · `/og-image.png` devuelve 404 en producción

**Encontrado en:** S0, verificación del baseline.
**Relacionado con:** H-05, que la auditoría clasificó como mejora de identidad de marca.

`src/app/layout.js` declara `og:image` y `twitter:image` apuntando a `/og-image.png`, y `src/lib/seo.js:22` lo usa como `DEFAULT_OG_IMAGE` para toda entidad que no traiga imagen propia. **El archivo no existe**, ni en `public/` ni en producción. Verificado: `curl -o /dev/null -w "%{http_code}" https://saludmentalcostarica.com/og-image.png` → `404`.

No es que falte una imagen mejor: es que la vista previa de todo lo que se comparte del sitio en WhatsApp, Instagram, Facebook y LinkedIn sale rota, hoy.

**Bloqueado por D1.** Hay que decidir si es archivo estático o generado, y qué muestra.

---

## HN-02 · La home y `/servicios` hornean su estado degradado en el build — **reparado**

**Encontrado en:** S1, fase de verificación de H-07 (build con `DATABASE_URL` inalcanzable).

### Corrección al enunciado original

La primera versión de este hallazgo decía que estas rutas «se tragan los errores de base en silencio». **Es inexacto y hay que dejarlo asentado.** `src/app/servicios/page.js` y `src/app/servicios/[id]/page.js` relanzan si el error no es de conexión, y muestran al visitante un aviso explícito de «temporalmente no disponible». Es una degradación deliberada y bien construida.

El problema real es más estrecho y solo aparece en el build.

### El problema

Ambas rutas se prerenderizan estáticas (`○ /` y `○ /servicios`, con revalidación de 5 min). Si el `next build` corre mientras la base no responde, **el estado degradado se hornea en el HTML estático y se sirve con HTTP 200** —a los visitantes y a Google— hasta que expire la revalidación.

Un aviso de error servido como 200 es un soft-404: le enseña al buscador que la página del catálogo de servicios dice que no hay servicios.

### La reparación

Degradar con elegancia significa cosas opuestas según cuándo pase, y esa es toda la corrección:

- **En una petición real**, degradar es correcto. El visitante ve algo y el próximo intento probablemente funcione. **No se tocó.**
- **En el build**, no. La política del proyecto para el build ya quedó fijada en H-07: si no hay base, el build falla y se ve.

Se agregaron `enPrerender()` y `fallarSiEsBuild()` a `src/lib/prisma-safe.js`, y se llaman desde el `catch` de las tres rutas que degradan.

### Dos cosas que aparecieron al repararlo

**La guarda solo debe cortar ante una falla de conexión real.** La primera versión relanzaba cualquier error y **rompió el build con la base sana**: la home se impone un timeout propio de 4 s (`Promise.race` en `src/app/page.js`), y durante el build quince workers consultan la misma base a la vez y lo disparan por contención propia. Un timeout de aplicación no es «no hay base».

**La home no se aplica su timeout durante el build.** Ese límite existe para que un visitante no espere a una base lenta. En el build no hay nadie esperando, y aplicarlo solo producía fallas por contención. Sin él, una falla real de conexión sí llega como tal y corta el build, que es lo que se busca.

**Verificado en las dos direcciones:** con base, el build sale con 0 y ninguna guarda se dispara; sin base, sale con 1 y nombra la ruta.

---

## HN-03 · El arnés se autoflagelaba contra el servidor local — **reparado**

**Encontrado en:** S1, primera corrida del arnés contra `localhost`.

La `DATABASE_URL` de desarrollo trae `connection_limit=1`. Con las 4 peticiones concurrentes que el arnés usaba por defecto, Prisma agotaba el pool y devolvía `P2024`: en la corrida produjo un `500` en `/blog` y cinco páginas servidas sin `<title>`. Todos falsos positivos, y se leen exactamente como si el sitio estuviera roto.

**Reparado:** `scripts/verify-seo.mjs` detecta si `--base` apunta a localhost y baja la concurrencia a 1 por su cuenta. Contra producción sigue en 4. `--concurrencia` sigue disponible para forzar el valor.

---

## HN-04 · `/panel/admin/tareas` ya existe

**Encontrado en:** S1, mapeo de rutas.

S16 especifica construir `/panel/tareas` como pantalla de aterrizaje del panel. Ya hay una ruta `/panel/admin/tareas` en el árbol. Antes de empezar S16 hay que ver qué hace: o se extiende, o se reemplaza, o conviven y hay que decidir cuál es la de aterrizaje.

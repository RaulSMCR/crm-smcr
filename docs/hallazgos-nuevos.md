# Hallazgos nuevos — plan SEO/GEO

Cosas que aparecieron durante la ejecución del plan y que **no** están en `docs/auditoria-seo-geo.md`.

| # | Hallazgo | Estado |
|---|---|---|
| HN-01 | `/og-image.png` devuelve 404 en producción | **reparado** el 2026-08-19 (D1 resuelta) |
| HN-02 | La home y `/servicios` hornean su estado degradado en el build | **reparado** el 2026-08-19 |
| HN-03 | El arnés se autoflagelaba contra el servidor local | **reparado** el 2026-08-19 |
| HN-04 | `/panel/admin/tareas` ya existe | **resuelto** — se incorporó ahí, decisión de Raúl |
| HN-05 | La caché de `next build` sirvió un prerender viejo | **anotado** — sin arreglo, es del build |

---

## HN-01 · `/og-image.png` devuelve 404 en producción — **reparado**

**Encontrado en:** S0, verificación del baseline.
**Cierra también:** H-05, que la auditoría clasificó como mejora de identidad de marca. No lo era: era una URL rota.

`src/app/layout.js` declaraba `og:image` y `twitter:image` apuntando a `/og-image.png`, y `src/lib/seo.js` lo usaba como `DEFAULT_OG_IMAGE` para toda entidad sin imagen propia. **El archivo no existía**, ni en `public/` ni en producción. Cada página compartida en WhatsApp, Instagram, Facebook o LinkedIn salía con la vista previa rota.

### D1, resuelta

Imagen **generada, con el título de cada página**. La tarjeta es el espacio donde se decide si alguien abre el enlace; quince artículos compartidos con la misma estampa lo desperdician.

`src/app/og/route.js` la compone con `ImageResponse` de Next: fondo `brand-950`, logo, nombre de la plataforma en versalitas, el título de la página, la regla coral de marca y una bajada opcional. Acepta `?t=` (título) y `?s=` (bajada).

Vive en `/og` y **no** bajo `/api/`: el robots.txt bloquea `/api/`, algunos rastreadores sociales respetan robots.txt al buscar la imagen, y una vista previa bloqueada por robots es la misma vista previa rota que esto viene a arreglar.

### Dos cosas que aparecieron al implementarlo

**El aviso «sin imagen social» del panel de SEO se habría apagado para siempre.** `src/app/panel/admin/marketing/seo/page.js` audita la salida de `resolveSeo`, y desde que hay una imagen generada por defecto el campo `image` nunca vuelve a quedar vacío: el aviso habría dado siempre «con imagen social», incluso para un artículo sin portada. `resolveSeo` ahora devuelve además `imagenPropia`, que distingue una imagen editorial de verdad de la generada, y `auditItem` la consulta primero. Con test que lo fija.

**Una portada propia siempre gana.** Si el artículo tiene `coverImage` o `ogImage`, se comparte con esa. La tarjeta generada es el piso, no el techo.

**Verificado:** las tarjetas se generan con acentos y ñ correctos, el logo renderiza, y `og:image` responde 200 en la home, las páginas legales, los perfiles y los artículos sin portada.

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

## HN-04 · `/panel/admin/tareas` ya existe — **resuelto**

**Encontrado en:** S1, mapeo de rutas.

S16 especificaba `/panel/tareas`. Ya existía `/panel/admin/tareas`, con un inventario operativo diario cuyo estado vivía en `localStorage`.

**Decisión de Raúl: incorporar ahí.** Las tareas sostenidas de SEO/GEO van arriba y el inventario operativo abajo. No se creó ninguna ruta nueva y no se desplazó nada de lo que ya funcionaba.

---

## HN-05 · La caché de `next build` sirvió un prerender viejo

**Encontrado en:** la verificación de HN-01.

Después de cambiar `src/lib/seo.js` y `src/app/layout.js` y de reconstruir con éxito, la home seguía emitiendo `og:image` apuntando al viejo `/og-image.png`. El artefacto `.next/server/app/index.html` era más reciente que los archivos fuente y aun así traía el valor anterior: la caché incremental de Next reusó el prerender de `/` pese al cambio.

Con `rm -rf .next` y reconstrucción limpia, el resultado fue el correcto.

No hay nada que arreglar en el proyecto. Queda anotado porque es la tercera trampa de instrumento del plan —junto con HN-03— y produce exactamente la conclusión equivocada: parece que el código no funciona cuando lo que falla es la verificación. **Ante un resultado que contradice el código fuente, reconstruir limpio antes de investigar.**

---

## HN-06 · `BlogPostCard` es código muerto

**Encontrado en:** S13, buscando dónde se renderizan las portadas.

`src/components/BlogPostCard.js` no se importa desde ningún lado. El listado de
`/blog` arma sus tarjetas con su propio marcado.

No se borró: está fuera del alcance de S13 y la regla del plan es no
refactorizar de paso. Es candidato para S15, que es el segmento de limpieza.

Importa poco por sí solo. Importa porque al migrar imágenes uno tiende a tocar
todos los componentes que parecen relevantes, y este habría consumido tiempo sin
cambiar nada de lo que se ve.

---

## HN-07 · S4 rompió el script de backfill de taxonomía y no me di cuenta

**Encontrado en:** al desbloquear S11, cuatro segmentos después de haberlo causado.

`scripts/backfill-blog-taxonomy.mjs` referencia artículos por **slug literal**.
S4 reparó los slugs mutilados, y de los ocho que el script nombraba, **siete
dejaron de existir**. Correrlo habría creado dos series y enlazado un artículo,
sin fallar: los avisos de "no encontré el artículo" salen por consola y el script
termina bien.

### Lo que falló en mi verificación

La verificación de S4 incluía «revisar enlaces internos que apunten a slugs
viejos hardcodeados». **Busqué en `src/` y en el cuerpo de los artículos, y no en
`scripts/`.** El plan decía «buscar en `src/`» y lo tomé al pie de la letra en
vez de preguntarme dónde más podía haber un slug escrito a mano.

Tres de los ocho slugs, además, ya no existían ni antes de S4: venían de un
estado del contenido anterior. El script llevaba tiempo desactualizado y nadie
lo notaba porque nadie lo corría.

### Reparado

Slugs actualizados, cinco series derivadas de los títulos reales, y **modo
dry-run por defecto**: ahora hay que mirar la lista antes de escribir, y un slug
muerto se ve como `! NO EXISTE` en vez de pasar como una advertencia entre otras.

También se le sacó la copia local de `slugify` —que es exactamente cómo nacieron
las siete versiones que S3 vino a juntar— y ahora importa la unificada.

**La fragilidad de fondo sigue:** un script que nombra artículos por slug se
rompe cada vez que un slug cambia. El dry-run hace que eso se note antes y no
después.

---

## HN-08 · Aprobar o suspender un profesional no tocaba su página pública

**Encontrado en:** al suspender a dos profesionales, después de S14.

`approveUser` y `rejectUser` revalidaban cinco rutas, **todas de `/panel`**.
Ninguna pública.

El efecto: aprobar a alguien no lo hacía aparecer en el sitio, y suspenderlo no
lo hacía desaparecer. Se resolvía solo cuando expiraba la revalidación.

Antes de S14 tardaba hasta una hora desde la primera visita. Después de S14, que
prerenderiza los perfiles en el build, el desfase es el mismo pero más visible:
la página existe horneada desde antes del cambio.

**Reparado:** las dos acciones revalidan ahora `/profesionales`,
`/profesionales/[slug]` y `/sitemap.xml`.

Lo que hace este hallazgo digno de anotarse no es la hora de demora: es que
**S14 no lo causó pero lo volvió visible**. Volver estática una ruta convierte
cada invalidación faltante en un bug con consecuencia, y este era el único caso
del proyecto donde el estado público de una persona depende de una acción de
panel.

---

## HN-09 · La verificación de correo rechazaba todos los enlaces

**Encontrado en:** al registrarse la primera usuaria real, 2026-08-20.
**Gravedad:** nadie podía verificar su cuenta. Ninguna persona registrada podía
completar el alta.

`src/app/verificar-email/page.js` leía el token así:

```js
const token = searchParams?.token;   // sin await
```

En Next 16 `searchParams` es una **Promise**. Leerla en forma síncrona devuelve
`undefined` sin lanzar ningún error, así que `token` era **siempre** undefined y
la página entraba siempre por la rama de «Enlace de verificación no válido» —
incluso con un token perfectamente bueno en la URL.

Comprobado contra producción antes de tocar nada: con token, sin token y con un
token de formato real, la página devolvía el mismo error las tres veces.

### El segundo error, encima del primero

El aviso que recibe quien se registra cuando el correo no sale dice: *«solicite
reenvío del enlace desde la pantalla de verificación»*.

Esa pantalla **no ofrecía forma de solicitar nada**: mostraba «utilice el enlace
enviado por correo» y un botón de «Volver al inicio». La única persona que llega
sin token es exactamente la que no recibió ese correo.

El formulario de reenvío existía —en `VerifyEmailClient.js`, con su endpoint en
`/api/auth/resend-verification`— pero `page.js` cortaba antes y nunca lo montaba.

### Reparado

`await searchParams`, y la rama sin token ahora ofrece el reenvío en vez de un
callejón sin salida.

### El mismo bug en tres páginas más

`/panel/admin/citas`, `/panel/admin/contabilidad` y
`/panel/admin/contabilidad/cierre-fiscal` leían `searchParams` igual. Sus filtros
—período, fechas, profesional, paciente, año y mes— **nunca se aplicaban**: cada
consulta usaba los valores por defecto sin importar qué eligiera el usuario.

Corregidas las tres.

### Por qué no lo detectó nada

El acceso síncrono a una Promise no lanza: devuelve `undefined`. No hay error en
consola, no hay build roto, no hay test que falle. La página responde 200 y se ve
bien; solo hace lo incorrecto. **Es el modo de fallo más caro que existe**, y ya
estaba documentado en la memoria del proyecto desde una vez anterior.

---

## HN-10 · `/panel/admin/tareas` reventaba con ReferenceError

**Encontrado en:** 2026-08-20, la primera vez que alguien abrió esa página con
sesión de admin.

```
ReferenceError: hoyEnCostaRica is not defined
```

`src/lib/frases.js` usaba `hoyEnCostaRica()` como **valor por defecto** de
`estadoDeVigencia()`, sin importarla: la función vive en
`psychosocial-calendar.js`.

`/panel/admin/frases` la llama con argumento —`estadoDeVigencia(hoy)`— así que
nunca falló. `/panel/admin/tareas` la llama sin argumento, y ahí el valor por
defecto se evalúa y revienta.

**No lo causó ningún cambio de esta sesión.** La línea existe desde antes del
primer commit del plan (`4e0b123`). La página estaba rota desde siempre; lo que
cambió es que ahora hay un admin que puede entrar a verla.

### Reparado

`hoyEnCostaRica` se mudó a `src/lib/timezone.js`, que es su lugar: lo necesita
medio proyecto. `psychosocial-calendar` lo reexporta para no romper a quien lo
importa desde ahí, y `frases.js` ahora sí lo importa.

De paso se eliminó una **tercera copia** que S16 había agregado en
`tareas-sostenidas.js` — el mismo patrón que produjo el problema.

### Casi lo repito en el mismo arreglo

Al consolidar escribí `export { hoyEnCostaRica as hoyCR }` y dejé
`calcularRacha(fechas, hoy = hoyCR())`. **Un `export { x as y }` no crea el
identificador `y` dentro del módulo**, así que eso habría reventado exactamente
igual — y los tests no lo habrían visto, porque todos le pasan la fecha
explícita.

### Por qué nada lo detectaba

Un valor por defecto solo se evalúa cuando el argumento no se pasa. Si todos los
tests pasan la fecha, la línea nunca se ejecuta: el build compila, los tests
pasan, y la página responde 200 hasta que alguien la abre.

`tests/unit/fecha-costa-rica.test.js` llama a las tres funciones **sin
argumentos**, que es el único llamado que ejercita el valor por defecto.

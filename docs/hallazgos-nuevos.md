# Hallazgos nuevos — plan SEO/GEO

Cosas que aparecieron durante la ejecución del plan y que **no** están en `docs/auditoria-seo-geo.md`.

Regla del plan (§4): no se arreglan sobre la marcha. Se anotan acá y se discuten.

---

## HN-01 · `/og-image.png` devuelve 404 en producción

**Encontrado en:** S0, verificación del baseline.
**Relacionado con:** H-05, que la auditoría clasificó como mejora de identidad de marca.

`src/app/layout.js` declara `og:image` y `twitter:image` apuntando a `/og-image.png`, y `src/lib/seo.js:22` lo usa como `DEFAULT_OG_IMAGE` para toda entidad que no traiga imagen propia. **El archivo no existe**, ni en `public/` ni en producción. Verificado: `curl -o /dev/null -w "%{http_code}" https://saludmentalcostarica.com/og-image.png` → `404`.

No es que falte una imagen mejor: es que la vista previa de todo lo que se comparte del sitio en WhatsApp, Instagram, Facebook y LinkedIn sale rota, hoy.

**Bloqueado por D1.** Hay que decidir si es archivo estático o generado, y qué muestra.

---

## HN-02 · La home y `/servicios` se tragan los errores de base en silencio

**Encontrado en:** S1, fase de verificación de H-07 (build con `DATABASE_URL` inalcanzable).

Al probar que el sitemap ahora falla el build cuando no hay base, la salida mostró que otras dos rutas hacen exactamente lo que se acaba de corregir en el sitemap:

```
La base de datos fallo, pero la web sigue viva: PrismaClientInitializationError
No se pudo cargar /servicios por falla de conexion a la base: PrismaClientInitializationError
```

La home y `/servicios` se prerenderizan **vacías** y el build pasa como si nada. En el sitemap eso significaba publicar un índice sin contenido; acá significa desplegar la portada del sitio y el catálogo de servicios sin un solo servicio, sin que nadie se entere.

Es el mismo patrón de H-07 en dos rutas más. La diferencia es que acá la degradación puede ser deliberada —una home a medias es mejor que un 500— y esa decisión no me corresponde tomarla.

**A discutir:** ¿degradar en silencio o fallar el build? Si se elige degradar, al menos debería quedar visible en el despliegue.

---

## HN-03 · El pool de Prisma en local está limitado a una conexión

**Encontrado en:** S1, primera corrida del arnés contra `localhost`.

Con `connection_limit=1` en la `DATABASE_URL` local, cuatro peticiones concurrentes bastan para que Prisma agote el pool y devuelva `P2024`. En la corrida del arnés produjo un `500` en `/blog` y cinco páginas servidas sin `<title>`, todos falsos positivos.

No es un defecto del sitio ni del arnés. Queda anotado porque **cualquier verificación local del plan tiene que correr con `--concurrencia 1`**, y si no se sabe, se pierde media hora persiguiendo un fantasma.

---

## HN-04 · `/panel/admin/tareas` ya existe

**Encontrado en:** S1, mapeo de rutas.

S16 especifica construir `/panel/tareas` como pantalla de aterrizaje del panel. Ya hay una ruta `/panel/admin/tareas` en el árbol. Antes de empezar S16 hay que ver qué hace: o se extiende, o se reemplaza, o conviven y hay que decidir cuál es la de aterrizaje.

# Indexación del hub — prompts para Claude con navegador

Contexto: el hub `/raul-olmedo-evans` se publicó el 2026-09-10 y no está indexado.
No hay bloqueo técnico (200, canonical correcto, sin `noindex`, en el sitemap).
Falta Search Console, que es lo que convierte semanas de espera en días.

**Orden obligatorio.** El paso 2 falla si se hace antes del despliegue del paso 1.

---

## 1 · Obtener el token de verificación de Google

> Abrí Google Search Console (https://search.google.com/search-console) con la
> cuenta de raul.olmedo@gmail.com. Creá una propiedad nueva del tipo **Prefijo de
> URL** con el valor exacto `https://saludmentalcostarica.com`.
>
> Cuando pida verificar la propiedad, elegí el método **Etiqueta HTML**. NO hagas
> clic en «Verificar» todavía. Copiame el valor del atributo `content` de la
> etiqueta que muestra: es una cadena de unos 40 caracteres dentro de
> `<meta name="google-site-verification" content="AQUÍ" />`.
>
> Devolveme solo esa cadena y dejá la pestaña abierta.

Con ese valor, en Vercel → Settings → Environment Variables:

- Nombre: `GOOGLE_SITE_VERIFICATION`
- Valor: la cadena
- Entornos: Production

Y volver a desplegar. El código ya emite la etiqueta cuando la variable existe
(`src/app/layout.js`); sin redespliegue la etiqueta no está en el HTML y Google
dice «no se pudo verificar».

Comprobación antes de seguir:

```
curl -s https://saludmentalcostarica.com/ | grep google-site-verification
```

Si no imprime nada, el despliegue todavía no salió.

---

## 2 · Verificar y enviar el sitemap

> En la pestaña de Search Console que quedó abierta, hacé clic en **Verificar**.
> Debería confirmar la propiedad.
>
> Después entrá a **Sitemaps** en el menú lateral y enviá `sitemap.xml`.
> Confirmame qué estado quedó («Correcto» y cuántas URLs detectó).
>
> Por último, andá a **Indexación → Páginas** y decime cuántas páginas figuran
> indexadas y cuántas no, con los motivos que liste.

---

## 3 · Solicitar indexación de las URLs del hub

> En Search Console, usá la **Inspección de URL** (la barra de arriba) para cada
> una de estas ocho URLs, una por vez. Para cada una: pegala, esperá el
> resultado, y si dice «La URL no está en Google», hacé clic en **Solicitar
> indexación** y esperá la confirmación antes de pasar a la siguiente.
>
> 1. https://saludmentalcostarica.com/raul-olmedo-evans
> 2. https://saludmentalcostarica.com/profesionales/raul-olmedo
> 3. https://saludmentalcostarica.com/raul-olmedo-evans/tratamiento-breve-15-sesiones
> 4. https://saludmentalcostarica.com/raul-olmedo-evans/ataque-de-panico
> 5. https://saludmentalcostarica.com/raul-olmedo-evans/duelo
> 6. https://saludmentalcostarica.com/raul-olmedo-evans/estres-laboral-y-burnout
> 7. https://saludmentalcostarica.com/raul-olmedo-evans/conflictos-de-pareja
> 8. https://saludmentalcostarica.com/raul-olmedo-evans/migracion-y-desarraigo
>
> Hacé una tabla con el estado que reportó cada una antes de solicitar, y si
> alguna dio un error de cobertura, copiame el mensaje textual.

Google limita las solicitudes a unas diez por día y por propiedad. Ocho entra.

---

## 4 · Bing (alimenta a ChatGPT y Copilot)

> Abrí Bing Webmaster Tools (https://www.bing.com/webmasters) y agregá el sitio
> `https://saludmentalcostarica.com`. Usá la opción de **importar desde Google
> Search Console**, que evita verificar de nuevo.
>
> Si la importación no está disponible, elegí la verificación por **etiqueta
> meta** y copiame el valor de `content` de `<meta name="msvalidate.01" …>`.
>
> Después enviá el sitemap `https://saludmentalcostarica.com/sitemap.xml` y usá
> **Enviar URL** con las ocho URLs del paso 3.

Si devuelve un token de etiqueta meta, va en Vercel como `BING_SITE_VERIFICATION`
(el layout ya lo contempla).

---

## 5 · Comprobar los datos estructurados después de desplegar

> Abrí https://search.google.com/test/rich-results y probá estas dos URLs, una
> por vez:
>
> - https://saludmentalcostarica.com/raul-olmedo-evans
> - https://saludmentalcostarica.com/profesionales/raul-olmedo
>
> Para cada una, buscá en el código detectado el nodo de tipo `Person` y
> copiame su campo `@id`. Necesito confirmar que las dos páginas devuelven
> exactamente el mismo valor, terminado en `#person`.
>
> Decime también si el informe muestra errores o advertencias, con su texto.

Si los dos `@id` coinciden, la corrección de esta sesión llegó a producción.

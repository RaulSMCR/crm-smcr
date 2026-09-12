# Indexación del hub — checklist y prompts

El hub `/raul-olmedo-evans` se publicó el 2026-09-10 y no está indexado. No hay
bloqueo técnico: responde 200, el canonical es correcto, no declara `noindex` y
está en el sitemap. La propiedad de Search Console ya existe y está verificada desde hace meses:
lo que falta es usarla —leer por qué no se indexa, enviar el sitemap y pedir
indexación—.

**Los pasos 0 y 1 van primero.** Pedir indexación antes de desplegar hace que la
primera lectura de Google sea de la versión con los defectos que ya se
corrigieron. El paso 2 se puede adelantar en paralelo: no depende del contenido.

---

## 0 · Aplicar la migración (antes de desplegar)

```
npm run migrate
```

Es `prisma migrate deploy`. Nunca `migrate dev` ni `migrate reset`.

La migración `20260912010000_hub_seo_editorial` es aditiva (`ADD COLUMN IF NOT
EXISTS` más un backfill que no pisa valores existentes), así que correrla contra
la base de producción con el código viejo todavía arriba es seguro: el código
viejo ignora columnas que no conoce.

Al revés no lo es. Si se despliega el código nuevo antes de la migración, cada
consulta al hub falla por columna inexistente, `getManagedHubData()` se traga el
error y el hub sirve el JSON congelado de agosto. Sin error y sin aviso.

## 1 · Desplegar

```
git push
```

El commit `e97d66c` ya está en `main`. Después del push, comprobar que salió:

```
curl -s https://saludmentalcostarica.com/raul-olmedo-evans | grep -o '#person"'
```

Tiene que imprimir `#person"` (sin la `a` final). Si imprime `#persona"`, el
despliegue todavía no salió.

---

## 2 · Leer lo que Search Console ya sabe

La propiedad existe y está verificada desde hace meses (el TXT
`google-site-verification` está puesto en el DNS de GoDaddy). No hay nada que
crear: hay que **leer**.

Esto importa más que los pasos siguientes. Si el sitio lleva meses verificado y
aun así tiene pocas páginas indexadas, el problema no es que el hub sea nuevo
—es algo del sitio entero— y el orden de trabajo cambia. Search Console lo dice
con números; desde afuera solo se puede suponer.

> Abrí Google Search Console (https://search.google.com/search-console) con la
> cuenta de raul.olmedo@gmail.com y entrá a la propiedad de
> `saludmentalcostarica.com`. Necesito que me traigas, textualmente:
>
> 1. En **Indexación → Páginas**: cuántas páginas indexadas y cuántas no
>    indexadas. Después abrí la lista de "no indexadas" y copiame cada motivo
>    con su cantidad (por ejemplo "Descubierta: actualmente sin indexar 40",
>    "Rastreada: actualmente sin indexar 12", "Página alternativa con etiqueta
>    canónica adecuada 3").
> 2. En **Sitemaps**: si hay alguno enviado, cuál, en qué fecha, qué estado y
>    cuántas URLs detectó.
> 3. En **Rendimiento**, con el rango de los últimos 3 meses: total de clics e
>    impresiones, y las 10 consultas con más impresiones.
> 4. En **Configuración → Estadísticas de rastreo**: total de solicitudes de
>    rastreo de los últimos 90 días y si muestra algún problema de
>    disponibilidad del host.
> 5. Poné `https://saludmentalcostarica.com/raul-olmedo-evans` en la
>    **Inspección de URL** y copiame todo lo que diga: estado, si fue rastreada
>    alguna vez, la fecha del último rastreo y el canónico declarado y el
>    seleccionado por Google.
>
> No cambies ninguna configuración. Esto es solo lectura.

Con esos cinco datos se sabe si el hub es un caso nuevo esperando turno o si hay
un problema de fondo. Lo que siga depende de la respuesta.

## 3 · Enviar el sitemap

> En Search Console, entrá a **Sitemaps** en el menú lateral y enviá
> `sitemap.xml`. Decime qué estado quedó y cuántas URLs detectó.
>
> Después andá a **Indexación → Páginas** y contame cuántas figuran indexadas y
> cuántas no, con los motivos que liste textualmente.

El sitemap se regenera cada hora. Si acabás de desplegar, esperá un rato antes de
sacar conclusiones sobre cuántas URLs trae.

---

## 4 · Solicitar indexación

Son **cinco** URLs, no ocho. Los temas de estrés laboral, conflictos de pareja y
migración están vacíos: ahora declaran `noindex` y salieron del sitemap a
propósito. Pedir su indexación solo produciría un error de cobertura. Entran
cuando tengan artículo.

> En Search Console, usá la **Inspección de URL** (la barra de arriba) con cada
> una de estas cinco, una por vez. Para cada una: pegala, esperá el resultado, y
> si dice que no está en Google, hacé clic en **Solicitar indexación** y esperá
> la confirmación antes de seguir.
>
> 1. https://saludmentalcostarica.com/raul-olmedo-evans
> 2. https://saludmentalcostarica.com/profesionales/raul-olmedo
> 3. https://saludmentalcostarica.com/raul-olmedo-evans/tratamiento-breve-15-sesiones
> 4. https://saludmentalcostarica.com/raul-olmedo-evans/ataque-de-panico
> 5. https://saludmentalcostarica.com/raul-olmedo-evans/duelo
>
> Armá una tabla con el estado que reportó cada una antes de solicitar. Si alguna
> da un error de cobertura, copiame el mensaje textual.

Google acepta unas diez solicitudes por día y por propiedad.

---

## 5 · Comprobar que la identidad llegó bien

> Abrí https://search.google.com/test/rich-results y probá estas dos URLs, una
> por vez:
>
> - https://saludmentalcostarica.com/raul-olmedo-evans
> - https://saludmentalcostarica.com/profesionales/raul-olmedo
>
> En cada una, buscá en el código detectado el nodo de tipo `Person` y copiame su
> campo `@id`. Necesito confirmar que las dos devuelven exactamente el mismo
> valor, terminado en `#person`.
>
> Decime también si el informe muestra errores o advertencias, con su texto.

Si los dos coinciden, Google ya lee una sola persona en vez de dos.

---

## 6 · Bing (alimenta a ChatGPT y Copilot)

Opcional para Google, pero es lo que indexa para los asistentes de IA.

> Abrí Bing Webmaster Tools (https://www.bing.com/webmasters) y agregá el sitio
> `https://saludmentalcostarica.com`. Usá **importar desde Google Search
> Console**, que evita verificar de nuevo.
>
> Si la importación no está disponible, elegí verificación por **etiqueta meta** y
> copiame el valor de `content` de `<meta name="msvalidate.01" …>`.
>
> Después enviá el sitemap `https://saludmentalcostarica.com/sitemap.xml` y usá
> **Enviar URL** con las cinco URLs del paso 4.

Si devuelve un token, va a Vercel como `BING_SITE_VERIFICATION`.

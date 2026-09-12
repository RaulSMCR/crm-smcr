# Indexación del hub — checklist y prompts

El hub `/raul-olmedo-evans` se publicó el 2026-09-10 y no está indexado. No hay
bloqueo técnico: responde 200, el canonical es correcto, no declara `noindex` y
está en el sitemap. Falta Search Console, que convierte semanas en días.

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

## 2 · Verificar la propiedad en Search Console

Dos caminos. **El de DNS es mejor y no depende del despliegue**: cubre el dominio
entero, subdominios incluidos, y no hay que tocar código.

### Camino A — DNS (recomendado)

> Abrí Google Search Console (https://search.google.com/search-console) con la
> cuenta de raul.olmedo@gmail.com. Agregá una propiedad del tipo **Dominio** con
> el valor `saludmentalcostarica.com`.
>
> Google va a pedir un registro TXT. Copiame el valor completo que muestra
> (empieza con `google-site-verification=`) y decime en qué proveedor está el
> dominio si lo detectás. Dejá la pestaña abierta.

Ese TXT se agrega en el panel del registrador del dominio. Puede tardar unos
minutos en propagarse; recién entonces hacer clic en Verificar.

### Camino B — etiqueta HTML (si no hay acceso al DNS)

> En Search Console, creá una propiedad del tipo **Prefijo de URL** con el valor
> `https://saludmentalcostarica.com`. Elegí el método **Etiqueta HTML** y NO
> hagas clic en Verificar todavía. Copiame el valor del atributo `content` de
> `<meta name="google-site-verification" content="AQUÍ" />`.

Ese valor va a Vercel → Settings → Environment Variables como
`GOOGLE_SITE_VERIFICATION` (entorno Production), y **hay que volver a desplegar**
antes de tocar Verificar. El código ya emite la etiqueta cuando la variable
existe. Comprobar con:

```
curl -s https://saludmentalcostarica.com/ | grep google-site-verification
```

---

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

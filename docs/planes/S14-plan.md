# S14 · Renderizado y prerender

**Estado:** ejecutado el 2026-08-20.
**Hallazgos:** H-40 cerrado. H-41 corregido, sin efecto medible todavía — ver §4.
**Riesgo:** medio. Cambió cómo se sirve todo el contenido público.

---

## 1. La medición, que era el punto del segmento

El plan pedía medir antes y después, no solo cambiar código. Contra producción,
mediana de varias muestras con cache-buster:

| Ruta | Antes | Después |
|---|---|---|
| `/blog/logicas-comunes-…` | **521 ms** `MISS` | **63 ms** `HIT` |
| `/blog/que-es-psicoterapia-…` | **527 ms** `MISS` | **63 ms** `HIT` |
| `/blog/capitulo-1-…` | **501 ms** `MISS` | **76 ms** `HIT` |
| `/profesionales/raul-olmedo` | **503 ms** `MISS` | **66 ms** `HIT` |
| `/servicios/nutricion` | **302 ms** `MISS` | **67 ms** `HIT` |
| `/` (ya era estática) | 80 ms `HIT` | 80 ms `HIT` |
| `/blog` | 525 ms `MISS` | **498 ms** `MISS` |

Unas siete veces más rápido en las 28 páginas de contenido. La home no cambió,
que es lo esperable: ya estaba prerenderizada, y sirve de control.

Una primera corrida dio 223 ms para `/` y 586 ms para `/blog`, que parecía una
regresión. Con siete muestras en vez de tres se ve que era ruido de red: el
máximo de `/` llega a 212 ms y el de `/blog` a 1015 ms. **Tres muestras no
alcanzaban para distinguir una mejora de una casualidad.**

---

## 2. H-40 · `generateStaticParams`

En `/blog/[slug]`, `/profesionales/[slug]` y `/servicios/[slug]`. El build pasa
de 39 a 67 páginas estáticas.

`dynamicParams` queda en `true`, su valor por defecto: un artículo publicado
después del build, o un slug viejo que necesita redirigir por `SlugRedirect`, se
resuelve en demanda igual que antes. Esto acelera lo conocido sin cerrar la
puerta a lo que aparezca.

### El perfil necesitó una cirugía chica

`/profesionales/[slug]` no podía ser estática porque leía `?serviceId=` para
preseleccionar el servicio de un botón. Ese enlace pasó a
`src/components/profile/BotonAgendar.js`, un componente cliente con `Suspense`.

El HTML prerenderizado trae **un enlace válido** al primer servicio del
profesional —no un hueco— y el ajuste al servicio pedido ocurre al hidratar.

**Lo que no verifiqué:** la corrección al hidratar. Es el patrón canónico de
`useSearchParams` y el fallback es correcto, pero comprobarlo exige un navegador
y desde la terminal solo pude verificar el lado servidor. El modo de fallo, si lo
hubiera, es benigno: el botón preseleccionaría el primer servicio en vez del que
venía en la URL.

---

## 3. Prerenderizar rompió el build, y por una razón que valía la pena entender

Con 67 páginas y quince workers en paralelo, el build empezó a fallar con `P2024`:
timeout esperando conexión, con `connection_limit=1`.

Ese límite está bien puesto: en producción cada función serverless vive poco y no
debe acaparar conexiones del pooler. **Pero el build no es serverless.** Es un
proceso largo que renderiza decenas de páginas a la vez, y ahí una sola conexión
es el ajuste equivocado.

`src/lib/prisma.js` sube el límite **solo durante `phase-production-build`**,
reescribiendo la URL en memoria. No se toca la variable de entorno: producción
sigue con el valor que le corresponde sin depender de que alguien recuerde
configurarlo distinto en dos lados.

---

## 4. H-41 · corregido, pero sin efecto medible todavía

`/blog` exportaba `revalidate = 300` que **no se aplicaba nunca**, porque
`await searchParams` vuelve dinámica la página. Se sacó el export, que hacía
creer que había cache donde no la había.

En su lugar se cachean los datos: las cuatro consultas que arman la barra de
filtros son idénticas para todo visitante y se hacían en secuencia en cada
visita. Ahora van por `unstable_cache` con revalidación de 300 s y tag
`biblioteca`.

**Y no se nota: 525 ms antes, 498 ms después, dentro del ruido.** El motivo es
que la taxonomía está vacía —cero disciplinas, cero temas, cero series (H-13)—,
así que esas cuatro consultas ya eran triviales. Lo que domina es la consulta de
artículos, que depende de los filtros y no se cachea.

La corrección es correcta y va a importar cuando haya taxonomía cargada. Hoy no
mejora nada, y decir lo contrario sería vender un número que la medición no
respalda.

---

## 5. Lo que cambió de comportamiento

Antes, cada página se renderizaba en la primera visita y quedaba cacheada una
hora desde ahí. Ahora se hornea en el build y se revalida una hora desde el
build. La invalidación por edición sigue funcionando: las acciones de edición
llaman a `revalidatePath`.

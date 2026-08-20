# S16 · Panel de tareas y medición

**Estado:** núcleo ejecutado el 2026-08-20. La corrida guiada de prompts queda bloqueada — ver §5.
**Riesgo:** bajo. Solo toca `/panel`, que es `noindex` y no tiene tráfico público.

---

## 1. HN-04, resuelto: se incorpora, no se crea

El plan pedía `/panel/tareas`. Ya existía `/panel/admin/tareas`, con un inventario
operativo diario. **Decisión de Raúl: incorporar ahí.**

Las tareas sostenidas de SEO/GEO van **arriba** y el inventario operativo abajo.
El orden no es casual: el inventario es la rutina del día y se hace igual; esto
es lo que solo pasa si alguien lo sostiene, y **lo que no se ve primero no se
hace**.

No se creó ninguna ruta nueva y no se desplazó nada de lo que ya funcionaba.

---

## 2. Lo que estaba mal y no era obvio

El inventario diario guardaba lo hecho en **`localStorage`**. Eso significa: por
navegador, perdido al cambiar de máquina, invisible desde el teléfono, y **sin
ninguna forma de calcular una racha** — porque no hay historia, solo el estado de
hoy en ese navegador.

`TaskLog` y `OutreachLog` lo mueven a la base. Es lo que permite que «¿escribí
ayer?» tenga respuesta.

---

## 3. Las cuatro zonas, y el principio que las ordena

**Ninguna tarea diaria es de medición.** La frecuencia de cada tarea sigue a la
velocidad de cambio del fenómeno, no a la disponibilidad de quien la ejecuta: la
indexación tarda semanas, las señales de entidad meses, las citaciones cambian
cuando cambia el modelo.

Revisar métricas se siente como trabajo, da sensación de control y no exige
enfrentar una página en blanco. Producir es incómodo y es lo único que mueve el
proyecto. Hay un test que fija esto: si alguien agrega una tarea diaria con
`search_console`, `bing` o `baseline` en la clave, la suite se pone roja.

| Zona | Qué tiene |
|---|---|
| **Hoy** | Dos ítems y ningún gráfico. Escribí · Contacté a alguien que pueda mencionarnos |
| **Esta semana** | Search Console · Bing AI Performance · estado del pipeline. 15 minutos |
| **Este mes** | La corrida del baseline, publicar dos ensayos, video con transcripción, deuda editorial, origen de consultas |
| **Este trimestre** | Re-correr la auditoría, evaluar el set de prompts, revisar credenciales |

El único número visible es la racha.

### D13 · la racha cuenta solo «escribí»

Contactar se registra y se ve, pero no la rompe. Una racha que exige dos cosas se
corta el doble de rápido, y una racha rota deja de motivar.

**Y no se corta si hoy todavía no se marcó:** se cuenta desde ayer. El día no
terminó, y mostrar cero a las nueve de la mañana castiga por no haber escrito
todavía — exactamente lo contrario de lo que la racha debería producir. Hay test.

La fecha se calcula en zona de Costa Rica, no en la del servidor. Si se calculara
en UTC, escribir después de las 18:00 contaría como el día siguiente y la racha
se cortaría o se duplicaría según la hora. También hay test.

### El contacto se registra una sola vez

Registrar el contacto marca la tarea diaria sola. Pedirle a alguien que anote a
quién escribió **y además** tilde una casilla es pedirle que diga lo mismo dos
veces, y es donde este tipo de registro se abandona.

---

## 4. Las dos tablas: consultas, no checkboxes

Esa es la diferencia entre una lista que **se vacía sola** a medida que se carga y
una que hay que mantener a mano, que queda desactualizada y deja de creerse.

**Deuda editorial** — hoy 28 filas: 15 artículos, 10 servicios, 3 perfiles. Cada
una enlaza al editor. Detecta también los 9 artículos cuyo título dice «Parte» o
«Capítulo» y no pertenecen a ninguna serie: una serie que existe en la cabeza de
quien escribe y no en el sitio.

**Pipeline por ensayo** — las tres primeras columnas son las citables, porque son
texto: bloque extractivo, video, transcripción. Slides y reels van aparte y
sombreados: son distribución. La tabla lo separa **para que la urgencia no se
reparta por igual entre cosas que no valen igual**.

### D12 · `extractiveBlock` es campo propio

No reusa `metaDescription`. Son dos textos con trabajos distintos: la meta
description compite por el clic en una lista de resultados y se corta a 160; el
bloque extractivo responde una pregunta completa para que un modelo lo cite sin
recortarlo. En un solo campo, uno de los dos sale mal.

---

## 5. Lo que NO se construyó

**La corrida guiada de 30 prompts por 5 motores.** El plan dice que los prompts
están especificados en `smcr-baseline-visibilidad.md`. **Ese documento no está en
el repositorio**, así que no tengo los 30 prompts ni sus códigos ni sus
categorías, y no los voy a inventar: el set está pensado para congelarse doce
meses, y un set inventado hoy arruinaría la serie temporal desde el primer punto.

La tarea aparece en la Zona 3 marcada como bloqueada, con el motivo escrito. Las
tablas `geo_prompts` y `geo_checks` tampoco se crearon, por lo mismo.

Cuando aparezca el documento, lo que falta es: sembrar los prompts, las dos
tablas, la pantalla previa de condiciones de medición, el asistente paso a paso
con guardado incremental, y el resumen de cierre comparando contra la corrida
anterior.

**Tampoco se automatiza la corrida**, y eso sí es deliberado y permanente: leer
las treinta respuestas es la mitad del valor del ejercicio. Muestra con qué
lenguaje responden hoy los modelos al sufrimiento, y ese lenguaje es contra qué
se escribe. El panel captura; no consulta motores.

**D11 quedó sin responder** — qué día de la semana para la revisión y qué día del
mes para la corrida. No bloquea nada: las tareas están ahí y se marcan cuando se
hacen. Fijar el día es una decisión de disciplina, no de software.

---

## 6. Verificación

- Build limpio, 692 tests (13 nuevos: racha, zona horaria, catálogo).
- La deuda editorial contra datos reales: 28 filas, coincide con el reporte de cierre de S15.
- Marcar una tarea persiste en la base y sobrevive a recargar.
- La racha se calcula bien con días salteados, cruzando mes y año.
- Ninguna métrica aparece en la pantalla de aterrizaje.

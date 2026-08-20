# S10 · Discordancia FAQ

**Estado:** ejecutado el 2026-08-20.
**Hallazgo:** H-20.
**Riesgo:** bajo. Solo contenido y marcado.

---

## 1. D8: se muestran, pero primero hubo que corregirlas

La auditoría contaba cuatro pares pregunta/respuesta declarados en JSON-LD que no
aparecían en la página. **Eran cinco**, y el problema no era solo que estuvieran
ocultos.

**Tres de las cinco respuestas afirmaban cosas falsas.** Es lo que pasa con el
contenido que nadie ve: se pudre sin que nadie lo note.

| Respuesta | Qué decía | Por qué era falso |
|---|---|---|
| Disciplinas | «psicología clínica, **coaching de vida y ejecutivo**, nutrición…» | ninguno de los diez servicios es coaching, y es la palabra que S1 sacó del layout por contradecir la línea del proyecto |
| Desde el extranjero | «las consultas son **100% virtuales**» | la plataforma atiende en ambas modalidades, y el precio puede diferir entre una y otra |
| Costo | «ver el precio en el perfil del profesional» | cierto en general, pero hoy no hay precios cargados |

## 2. Una sola fuente

Las preguntas viven ahora en un arreglo `PREGUNTAS` que alimenta **el marcado y
lo que se ve**. No pueden desincronizarse porque son lo mismo. Es el patrón que
`/faq` ya usaba y por eso `/faq` nunca tuvo este problema.

Se reescribieron las cinco con datos ciertos. La de verificación ahora describe
el procedimiento real que S7 implementó —revisión de la matrícula en el registro
público del colegio antes de la entrevista— y le dice al lector que puede
comprobarlo por su cuenta desde cada perfil.

Se agregó al pie un enlace a `/faq`, que tiene otras siete preguntas visibles.

---

## 3. Servicios sin profesional asignado

Decisión de Raúl: los servicios se quedan publicados aunque todavía no tengan a
nadie, y se dice que se está contratando.

«Actualmente no hay profesionales asignados» suena a que el servicio no existe.
Ahora dice **«Estamos incorporando profesionales para este servicio»**, con un
enlace al registro profesional para quien quiera sumarse y otro a los servicios
que sí están disponibles. En el listado, cada tarjeta lo marca.

---

## 4. Dos cosas que aparecieron barriendo «coaching»

La palabra estaba en tres lugares, no en uno.

**La meta description de `/servicios`** decía «psicología clínica, coaching,
nutrición, deporte y más». Reemplazada por las disciplinas reales.

**Las categorías de respaldo de la home** —las que se muestran si la base no
responde— eran `psico`, `nutri` y `coach`. **Esos slugs no corresponden a ningún
servicio**: la home degradada enlazaba a tres 404. Ahora usan slugs reales, que
desde S6 son estables.

Ese segundo hallazgo no tiene nada que ver con H-20; apareció porque buscar una
palabra en todo el proyecto es más barato que buscarla en el archivo donde uno
cree que está.

---

## 5. Verificación

- Las cinco preguntas del marcado aparecen en el HTML. Comprobado una por una.
- «coaching» y «100% virtual» ya no aparecen en ninguna página.
- Build limpio, 676 tests.

---

## 6. Modalidad de Raúl

Su lugar de práctica pasó a `VIRTUAL`, según su indicación. Eso quita el
`workLocation` de su perfil —una consulta virtual no tiene dirección— y deja la
dirección de San José solo en la organización, que es donde corresponde: es el
domicilio de registro de la empresa, no un consultorio.

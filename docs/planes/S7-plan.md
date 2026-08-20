# S7 · Modelo de credenciales ⚠

**Estado:** ejecutado el 2026-08-20.
**Hallazgos:** H-22, H-23, H-36.
**Riesgo:** medio. Migración aditiva y normalización de cuatro valores.

---

## 1. Las decisiones que lo desbloquearon

**D7 — procedimiento de verificación.** Es el que ya se hace: el profesional
envía su CV; antes de entrevistarlo, el admin revisa su matrícula en el colegio
correspondiente y adjunta el enlace al punto del registro público donde aparece.

Eso definió dónde va la interfaz. La verificación **no** es una pantalla aparte:
vive en la lista de profesionales pendientes, junto al CV y al botón de aprobar,
porque es parte del mismo momento. Una pantalla separada es una pantalla que hay
que acordarse de visitar.

**D6 — URIs externas: solo la del colegio, cargada por el admin.** Simplifica el
modelo: no hace falta un campo `sameAs` como arreglo. El `sameAs` del JSON-LD se
arma con la única URI que existe, y tiene la ventaja de ser la de mayor peso
probatorio y la única que no depende de que la persona la mantenga viva.

**D5 — el catálogo nombra la disciplina**, no a quien la ejerce.

### La consecuencia de D5, asumida

Si `specialty` guarda `"Psicología clínica"`, entonces **no puede ir directo a
`jobTitle`**: un cargo es una persona, no un área del saber. Poner "Psicología
clínica" como jobTitle es como decir que el puesto de alguien es "Contabilidad".

Por eso `src/lib/disciplinas.js` guarda las dos cosas por entrada —`nombre` y
`titulo`— y `tituloDe()` hace la conversión al emitir el esquema. Es el trabajo
extra que la opción elegida traía, y estaba anunciado.

Si el valor guardado no está en el catálogo, `tituloDe()` **devuelve el crudo en
vez de inventar un título**. En categoría YMYL, una credencial inventada es peor
que una imprecisa.

---

## 2. H-36 · las cuatro grafías

Con cuatro perfiles ya había cuatro formas de escribir lo mismo. No es cosmético:
ese valor alimenta el `jobTitle` de dos esquemas, y cuatro grafías son cuatro
entidades distintas para un buscador.

| Perfil | Antes | Después |
|---|---|---|
| andrea-robles | `psicologia clínica` | `Psicología clínica` |
| esteban-madrigal | `Psicología Clínica` | `Psicología clínica` |
| mariano-zorrilla | `Psicólogo clínico` | `Psicología clínica` |
| raul-olmedo | `Psicólogo` | `Psicología clínica` |

El catálogo es una constante validada y **no un enum de Prisma**: un enum obliga
a una migración de tipo cada vez que el equipo suma una disciplina, y este
proyecto crece justamente por ahí. Las nueve entradas salen de los servicios que
ya se ofrecen.

---

## 3. H-22 y H-23 · la credencial

Campos nuevos en `ProfessionalProfile`: `licensingBody`, `licenseVerifiedAt`,
`licenseVerificationUrl`, `licenseVerifiedById` (con FK a `User`, `RESTRICT` —
borrar al admin que verificó no debería borrar la evidencia de que verificó).

**No se agregó `sameAs` como campo**, por D6.
**No se agregó ningún campo de rating**, por la sección 4 del plan.

### Lo que cambia en el JSON-LD

`licenseNumber` **deja de emitirse como `identifier` suelto**. Un identificador
sin autoridad emisora no dice nada: es un número. Ahora, cuando hay colegio
registrado, se emite como `hasCredential` →
`EducationalOccupationalCredential`, con `recognizedBy` apuntando al colegio y el
número como `PropertyValue` con su `propertyID`. Se agrega `memberOf` hacia el
colegio y `sameAs` con la URL del registro.

Sin colegio registrado, cae al `identifier` suelto de antes. Es peor, y es
honesto: no se puede declarar una autoridad emisora que nadie cargó.

**Se mantiene `Person` y no se cambia a `Physician`**, según la corrección del
plan a H-24: ese tipo está reservado a profesionales con titulación médica y
aplicarlo a un psicólogo sería una declaración falsa.

### Lo que cambia en la ficha visible

Una credencial verificada y una declarada no son lo mismo, y la ficha ya no las
presenta igual. Con verificación, se muestra el colegio, la matrícula y un enlace
al registro público con el texto «verificada en el colegio». Sin verificación,
solo el número, como antes.

---

## 4. Verificación

- Build limpio, 676 tests (5 nuevos del catálogo).
- `jobTitle` del perfil pasa de `"Psicólogo"` a **`"Psicólogo clínico"`**.
- Las cuatro especialidades quedaron normalizadas.
- El formulario de verificación aparece en la lista de pendientes.

**Lo que todavía no se puede verificar:** ningún perfil tiene colegiatura
registrada, así que la rama de `hasCredential` del JSON-LD **no se ejerció contra
datos reales**. Se ejerce sola en cuanto Raúl cargue la primera verificación.

---

## 5. Pendiente

Cargar la verificación de los cuatro profesionales actuales: colegio, matrícula y
enlace al registro público. Los números de matrícula ya están; falta el colegio y
el enlace, que son lo que los vuelve comprobables.

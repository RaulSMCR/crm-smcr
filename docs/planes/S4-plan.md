# S4 · Regeneración de slugs de artículos ⚠

**Estado:** ejecutado el 2026-08-20.
**Hallazgo:** H-02 (y de arrastre, el caso publicado de H-30).
**Riesgo:** el más alto del plan. Toca datos de producción de contenido publicado e indexado.

---

## 1. El dry-run cambió el alcance del segmento

El plan hablaba de «los siete slugs mutilados». Derivar el slug del título y cambiar todo lo que no coincidiera proponía tocar **14 de 15 artículos**, y eso habría sido un error.

Seis artículos tienen slugs cortos y legibles que alguien eligió a mano. El automático es el título entero convertido y recortado a 80 caracteres:

```
mundo-encerro-locura-nacimiento-clinica
  automático: capitulo-2-el-mundo-que-encerro-a-la-locura-de-la-nave-de-los-necios-al
```

Cortado a mitad de frase, terminando en «al». Cambiarlo no arregla nada y quema una URL indexada.

**Por eso el criterio no es «difiere del título» sino «tiene la firma del bug».**

### Cómo se detecta la firma

Tres vías, y alcanza con cualquiera:

| Vía | Qué busca | Ejemplo |
|---|---|---|
| Token corto huérfano | uno o dos caracteres que no son palabra corta legítima del español | la `é` de "Qué" dejó `qu`; la `ó` de "Lógicas" dejó `l`; la `ó` de "introducción" dejó una `n` suelta |
| Par que reconstruye una palabra | dos tokens que, pegados, forman una palabra del título a la que le falta exactamente una letra | `psic` + `logo` = `psiclogo`, y el título dice `psicologo` |
| Sufijo aleatorio | cinco caracteres con letras y dígitos mezclados al final (H-30) | `-8oyy6` |

La segunda vía existe porque cuando el guión cae en medio de una palabra larga no deja ningún fragmento corto, y la primera vía no lo ve.

### Dos ajustes que salieron de leer el resultado

**`a` + `la` daba `ala`, parecido a `alma`.** La segunda vía marcaba como roto `serie-del-alma-atribulada-a-la-salud-mental`, que está perfectamente sano. Se descarta el par cuando ambos tokens son palabras legítimas.

**El sufijo aleatorio no lo cazaba ninguna regla**, porque tiene cinco caracteres y ningún token corto. Necesitó vía propia.

**Resultado: 8 a reparar, 6 intocables, 1 que ya coincidía.**

---

## 2. Lo que se cambió

| Slug viejo | Slug nuevo | Motivo |
|---|---|---|
| `del-alma-atribulada-...-geneal-gico-introducci-n` | `capitulo-1-del-cuidado-de-si-al-cuidado-pastoral-el-alma-antes-de-la-clinica` | token suelto `n` |
| `l-gicas-comunes-m-s-all-de-la-dicotom-a-salud-enfermedad` | `logicas-comunes-mas-alla-de-la-dicotomia-salud-enfermedad` | token suelto `l` |
| `qu-es-...-parte-2` | `que-es-psicoterapia-y-como-orientarse-entre-escuelas-parte-2` | token suelto `qu` |
| `qu-es-...-parte-3` | `que-es-psicoterapia-y-como-orientarse-entre-escuelas-parte-3` | token suelto `qu` |
| `qu-es-...-parte-4` | `que-es-psicoterapia-y-como-orientarse-entre-escuelas-parte-4` | token suelto `qu` |
| `autoayuda-pop-y-psic-logo-influencer` | `autoayuda-pop-y-psicologo-influencer-parte-i` | `psic-logo` → `psicologo` |
| `la-salud-mental-no-cabe-en-una-sola-disciplina-8oyy6` | `la-salud-mental-no-cabe-en-una-sola-disciplina-ii` | sufijo aleatorio |
| `autoayuda-pop-y-psic-logo-influencer-parte-ii` | `autoayuda-pop-y-psicologo-influencer-parte-ii` | `psic-logo` → `psicologo` |

El del Capítulo 1 tenía el slug de un título anterior: el artículo se retituló y el slug no lo siguió.

### Los seis que no se tocaron

```
mundo-encerro-locura-nacimiento-clinica
siglo-xx-palabra-pastilla-codigo
oms-consagracion-global-salud-mental-alma-ata
serie-del-alma-atribulada-a-la-salud-mental
la-salud-mental-despues-de-las-luces
la-salud-mental-no-cabe-en-una-sola-disciplina
```

**Queda una asimetría conocida:** la Parte I de «no cabe en una sola disciplina» no lleva `-i` y la Parte II ahora sí lleva `-ii`. Se dejó así porque cambiar la Parte I quemaría una URL sana solo por simetría. Si se quiere igualar, va por `--overrides`.

---

## 3. Verificación

| Criterio | Resultado |
|---|---|
| Los 8 slugs nuevos responden 200 | **8/8** |
| Los 8 slugs viejos redirigen | **8/8 → 308** |
| Ninguna URL del inventario de S0 devuelve 404 | cumplido — el único 404 es `/profesionales/mariano-zorrilla`, que ya lo era antes y es correcto |
| Enlaces internos a slugs viejos en `src/` | ninguno (solo comentarios que citan el bug) |
| Enlaces internos en el cuerpo de los artículos | ninguna referencia literal |
| Arnés completo | 40 URLs: 8 redirecciones, 1 404 esperado, 31 limpias |

**Es 308 y no 301**, como quedó asentado en S2: `permanentRedirect()` de Next emite 308, Google lo trata igual que 301.

### El sitemap tarda hasta una hora

Justo después de la migración, `/sitemap.xml` seguía listando los 8 slugs viejos. No es un fallo: la ruta declara `revalidate = 3600` desde S1 y se estaba sirviendo de caché (`X-Vercel-Cache: HIT`). Se corrige sola dentro de la hora.

Conviene comprobarlo antes de pedir reindexación, porque pedirla con el sitemap viejo es pedirle a Google que indexe URLs que ahora redirigen.

---

## 4. Rollback

```bash
node scripts/migrate-post-slugs.mjs --revert docs/backups/pre-seo-2026-08-20.json --commit
```

Restaura los slugs y **borra los redirects que esta corrida creó**: dejarlos haría que la URL restaurada redirigiera a la nueva y de vuelta, en bucle.

El respaldo `pre-seo-2026-08-20.json` se regeneró justo antes de esta migración, después de la restauración de la base. **Vive solo en la máquina de Raúl** (`docs/backups/` está en `.gitignore`).

---

## 5. Pendiente, y no es de Claude Code

**Pedir reindexación en Search Console** de las 8 URLs nuevas, una vez que el sitemap se haya refrescado.

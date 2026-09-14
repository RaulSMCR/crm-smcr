# Hallazgos — panel de administración

Cosas que aparecen al usar `/panel/admin` en el día a día. Fuera del alcance de
`docs/auditoria-seo-geo.md` y de `docs/hallazgos-nuevos.md`, que son del plan SEO/GEO.

| # | Hallazgo | Estado |
|---|---|---|
| PA-01 | La reseña del profesional queda trunca a cuatro líneas y no se puede expandir | **reparado** el 2026-09-03 |
| PA-02 | «Pedir ajustes» manda una nota genérica: no hay forma de decir qué corregir | **reparado** el 2026-09-03 |
| PA-03 | La zona de subida de `.md` del hub es una sola y el módulo lo decide el nombre del archivo | **reparado** el 2026-09-13 |
| PA-04 | El orden de aparición de las piezas del hub se editaba número por número, y el panel podía mostrar un orden distinto del publicado | **reparado** el 2026-09-13 · **requiere migración** |

PA-01 y PA-02 los reportó Raúl el 2026-09-03 revisando el alta de una profesional;
PA-03 el 2026-09-13, editando los módulos del hub.

---

## PA-01 · La reseña queda trunca — **reparado**

`src/app/panel/admin/personal/page.js:283` renderiza la reseña con `line-clamp-4`:

```jsx
<p className="mt-3 line-clamp-4 whitespace-pre-line text-sm text-slate-700">
  {reviewPreview}
</p>
```

Cuatro líneas, corte duro, sin «ver más» y sin enlace a la reseña completa. El
texto que se recorta es `profileReviewDraft || profileReview`, o sea justo el que
está en evaluación.

**Por qué importa:** los botones «Aprobar reseña» y «Pedir ajustes» están debajo de
ese recorte. Se está aprobando para publicación un texto que no se puede leer
entero desde la pantalla donde se aprueba.

### La reparación

`src/components/admin/ResenaExpandible.js`: mantiene el recorte a cuatro líneas
—la lista sigue siendo escaneable— y agrega «Ver reseña completa», que además
anuncia el largo en caracteres antes de abrir.

El botón aparece solo si el texto pasa de 260 caracteres. Es una estimación a
propósito: medir el nodo real obligaría a un efecto de layout por cada profesional
de la lista, y el costo de errarle es un botón de más, no un texto escondido.

---

## PA-02 · «Pedir ajustes» no permite decir qué ajustar — **reparado**

`src/app/api/admin/professionals/[id]/profile-review/reject/route.js:40` escribe una
nota **fija**, idéntica para todos los casos:

```js
profileReviewAdminNote: "Revise el contenido de la resena y vuelva a enviarlo para aprobacion.",
```

El endpoint no lee el body, y `AdminApproveButton`
(`src/components/AdminApproveButton.js`) hace un POST sin cuerpo: no existe ningún
input en toda la ruta. El profesional recibe «revise el contenido» sin ninguna
indicación de qué cambiar, y la única salida es adivinar o escribir por fuera de la
plataforma.

De paso, ese texto fijo va sin tildes («resena», «aprobacion») y en un registro de
tuteo/usted inconsistente con el resto de la plataforma, que vosea.

### Lo caro ya está hecho

El canal existe de punta a punta y funciona; lo único que falta es dónde escribir:

| Pieza | Estado |
|---|---|
| Columna `profileReviewAdminNote` en `ProfessionalProfile` | existe |
| El admin ve la nota | `panel/admin/personal/page.js:290-291` |
| **El profesional ve la nota** | `components/profile/ProfileEditor.js:396-397` |
| Se limpia al reenviar el borrador | `actions/profile-actions.js:196,203` |
| Campo para que el admin la escriba | **no existe** |

### La reparación

`src/components/admin/PedirAjustesResena.js` reemplaza al `AdminApproveButton` en
ese botón: despliega un textarea (tope 1000 caracteres) y postea `{ adminNote }`.
Sustituye al genérico porque `AdminApproveButton` postea sin cuerpo por diseño y
no tenía cómo hacer viajar el motivo.

El endpoint lee `adminNote`, lo recorta a `NOTA_MAX` y cae en `NOTA_POR_DEFECTO`
solo si viene vacío, así que una llamada sin cuerpo se sigue comportando como
antes. El texto por defecto se corrigió de paso: llevaba «resena» y «aprobacion»
sin tildes y trataba de usted en una plataforma que vosea.

El formulario avisa en su propio pie que lo escrito ahí es lo único que el
profesional va a leer sobre por qué no se publicó.

**Verificado:** `npm run build` y `npm test` (831 pasan) el 2026-09-03. No se
agregó test de ruta: la suite cubre `src/lib` y no hay ningún test de endpoint al
que sumarse, así que habría que inventar el andamiaje de mocks.

---

## PA-03 · La subida de `.md` no tenía destino elegible — **reparado**

El editor del hub tenía **una** zona de arrastre, arriba de todos los módulos
(`HubMarkdownIngest` en `src/components/admin/ProfessionalHubEditor.js`), y el
módulo de destino salía del **nombre del archivo**: `slugDeArchivo(nombre)` en
`src/lib/hub-markdown.js`.

**Por qué importa:** desde el formulario de un módulo no había forma de decir
«este archivo va acá». Soltar `duelo-corregido.md` para actualizar el módulo
`duelo` no lo actualizaba: creaba un módulo nuevo en `/<hub>/duelo-corregido`, en
borrador, con la misma búsqueda objetivo que el original —o sea, bloqueado por
canibalización si la traía, y contenido duplicado si no—. La única salida era
renombrar el archivo al slug exacto antes de soltarlo, algo que nadie adivina
mirando la pantalla.

### La reparación

Un campo, `destino`, y dos lugares donde usarlo:

| Pieza | Cambio |
|---|---|
| `parseHubDocument(texto, nombre, { slug })` | el módulo elegido manda sobre el nombre del archivo |
| `leerLote` / `aplicarLote` | aceptan `destino`; validan que exista, que sea uno solo y que no sea `_hub` |
| `preview` / `confirm` | `destino` viaja en el JSON; un destino inválido es `422`, no `404` |
| `HubMarkdownIngest` | selector de módulo en la zona del hub, y modo `compacto` con `destino` fijo |
| `ProfessionalHubEditor` | cada `ModuleForm` lleva su propia zona de arrastre |

Tres cosas que se decidieron de paso, porque el retargeting las volvía
alcanzables:

- **El tipo del módulo lo decide el panel.** El `.md` nunca declara uno —sale de
  la convención de slugs—, así que un módulo marcado a mano como «tratamiento» o
  «contenido personalizado» conserva su tipo y se avisa. Antes solo se protegía
  `CUSTOM`.
- **`tipo: hub` dirigido a un módulo se bloquea.** Son dos intenciones
  incompatibles; adivinar una sería escribir lo que nadie pidió.
- **El `key` del formulario lleva `updatedAt`.** Sin eso, un módulo reescrito por
  la ingesta seguía mostrando el texto viejo en los campos: `defaultValue` no
  vuelve a pintar un input ya montado, y el `router.refresh()` no alcanzaba.

El informe previo sigue siendo obligatorio en las dos zonas: el destino cambia
dónde se escribe, no la regla de que nada se escribe sin haber mostrado el diff.

**Verificado:** `npm run build` y `npm test` (1041 pasan, 37 salteados) el
2026-09-13, más nueve tests nuevos de destino en `tests/unit/hub-ingest.test.js` y
tres en `tests/unit/hub-markdown.test.js`. Sin verificación visual en el navegador.

---

## PA-04 · El orden de las piezas no era gobernable — **reparado**

Salió de PA-03: el orden con el que las tarjetas aparecen en `/<hub>` es lo
primero que se lee, y se editaba escribiendo un número en el campo «Posición» de
cada módulo, uno por uno.

**Por qué importa.** Tres cosas, de menor a mayor:

1. Para meter una pieza al frente había que renumerar a mano las otras cinco.
2. `integer("")` devuelve `0`, así que borrar el campo mandaba la pieza al primer
   lugar sin avisar — y el campo se guardaba en cada «Guardar módulo».
3. Lo serio: las dos consultas desempataban distinto.

| | orden |
|---|---|
| Panel (`ADMIN_HUB_INCLUDE`) | `position`, y a igualdad `createdAt` |
| Página pública (`PUBLIC_HUB_INCLUDE`) | `position` **y nada más** |

Con dos módulos en el mismo número, el panel mostraba un orden estable y la
página resolvía el empate como quisiera Postgres. **El panel podía mostrar un
orden que no era el que ve quien entra**, y podía cambiar entre consultas. Los
empates eran fáciles de producir, porque los números se escribían de a uno.

### La reparación

Una pantalla propia, arriba de los formularios: `HubModuleOrder`. El orden se ve
completo, se mueve con flechas y se guarda **contiguo** (`0..n-1`) en una sola
transacción, así que no hay empates que desempatar. La lógica está en
`src/lib/hub-order.js`, puro y con 14 tests: la suite de este repo cubre `src/lib`
y no las server actions.

Tres decisiones que van con eso:

- **La pantalla dice qué piezas no se ven y por qué** (`motivoFueraDeGrilla`). La
  grilla pública pinta solo temas visibles y publicados, así que un orden de cinco
  tarjetas de las que en el sitio aparecen dos hacía parecer que el orden no
  funcionaba.
- **El campo «Posición» sale del formulario del módulo.** Para que sacarlo no lo
  resetee a `0` en cada guardado, `moduleData` ahora manda `undefined` cuando no
  viene, y un módulo nuevo se crea al final en vez de al frente.
- **Una tarjeta destacada por hub** (`isFeatured`): se pinta primera y a ancho
  completo, con «Empezá por acá» en lugar de «Tema». Orden y destaque son dos
  decisiones distintas —una dice qué se lee antes, la otra qué se ve antes de
  leer—, así que es columna propia y no un `position = 0`. La regla «una sola»
  vive en un índice parcial y no en la pantalla: el panel es un escritor y la
  ingesta de `.md` es otro. El `.md` **no** puede marcarla, por decisión.

### Pendiente antes de desplegar

La migración `20260913120000_hub_modulo_destacado` **no está aplicada**. Verificado
el 2026-09-13 contra `information_schema`: la base no tiene `isFeatured`.

Si el código sale antes que la migración, la consulta del hub falla, y
`getManagedHubData` cae al `data/hub-raul.json` estático: la página sigue en pie
pero deja de mostrar todo lo que se edita en el panel. Ese fallback era mudo; ahora
deja un `console.error`, que es lo que se busca cuando «el panel no cambia nada».

#### Cómo aplicarla

Primero la migración, después el despliegue. En el orden inverso el hub se cae al
JSON estático hasta que la columna exista.

El SQL de `20260913120000_hub_modulo_destacado` es aditivo e idempotente, y la
fila de `_prisma_migrations` va a mano con el checksum del archivo —el
procedimiento de este proyecto, que no usa `migrate dev` ni `migrate deploy`—.
Todo junto, para pegar una sola vez en el SQL Editor de Supabase:

```sql
ALTER TABLE "ProfessionalHubModule" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "ProfessionalHubModule_una_destacada_por_hub"
    ON "ProfessionalHubModule" ("hubId")
 WHERE "isFeatured";

-- El registro de la migración. `_prisma_migrations` no tiene único sobre
-- `migration_name`, así que la guarda es el NOT EXISTS y no un ON CONFLICT.
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
SELECT gen_random_uuid()::text,
       'cd5a834e0f9dbe4abdc6b67349a77de92175212e299500c4e953bb113021c6f3',
       now(), '20260913120000_hub_modulo_destacado', now(), 1
 WHERE NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = '20260913120000_hub_modulo_destacado');
```

El checksum es el sha256 de `migration.sql` **tal como está en disco, en LF**. Si
alguien edita ese archivo después, deja de coincidir — y una migración aplicada
no se edita.

Para verificar que quedó:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'ProfessionalHubModule' AND column_name = 'isFeatured';
SELECT indexname FROM pg_indexes
 WHERE indexname = 'ProfessionalHubModule_una_destacada_por_hub';
SELECT migration_name, finished_at FROM _prisma_migrations
 WHERE migration_name = '20260913120000_hub_modulo_destacado';
```

**Verificado:** `npm run build` y `npm test` (1055 pasan, 37 salteados) el
2026-09-13. Sin verificación visual en el navegador, y sin aplicar la migración:
la escritura en producción quedó del lado de Raúl, porque el entorno bloquea esa
acción desde esta sesión.

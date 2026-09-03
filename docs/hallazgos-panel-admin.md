# Hallazgos — panel de administración

Cosas que aparecen al usar `/panel/admin` en el día a día. Fuera del alcance de
`docs/auditoria-seo-geo.md` y de `docs/hallazgos-nuevos.md`, que son del plan SEO/GEO.

| # | Hallazgo | Estado |
|---|---|---|
| PA-01 | La reseña del profesional queda trunca a cuatro líneas y no se puede expandir | **reparado** el 2026-09-03 |
| PA-02 | «Pedir ajustes» manda una nota genérica: no hay forma de decir qué corregir | **reparado** el 2026-09-03 |

Ambos los reportó Raúl el 2026-09-03 revisando el alta de una profesional.

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

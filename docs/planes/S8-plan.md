# S8 · Grafo JSON-LD enlazado

**Estado:** ejecutado el 2026-08-20.
**Hallazgos:** H-21, H-24, H-42.
**Riesgo:** bajo. Solo cambia lo que se emite; ninguna consulta ni URL.

---

## 1. El problema, dicho con precisión

Cada página emitía sus nodos sueltos. El artículo traía un autor **embebido** con
nombre, foto y cargo; el perfil de esa misma persona traía otro nodo `Person` con
los mismos datos.

Para un buscador **eso son dos personas distintas que se llaman igual**, no una
persona con dos apariciones. Quince artículos del mismo autor eran quince
personas, y ninguna de las quince tenía colegiatura: las credenciales que S7
acababa de verificar vivían solo en el perfil, sin llegar a los artículos.

La organización tenía el mismo problema multiplicado por tres.

---

## 2. Verificación del vocabulario, antes de escribir

El plan pedía explícitamente comprobar contra schema.org y no dar la tabla por
buena. Se hizo. Las siete propiedades usadas —`hasCredential`, `knowsAbout`,
`memberOf`, `worksFor`, `jobTitle`, `sameAs`, `alumniOf`— existen hoy, ninguna
está deprecada, y `Person` es un tipo válido para un psicólogo colegiado.

Eso confirma la corrección del plan a **H-24**: no hacía falta `Physician` —que
además habría sido una declaración falsa para un psicólogo—, sino `Person` bien
descrito.

---

## 3. El esquema de `@id`

| Entidad | `@id` |
|---|---|
| Organización | `{BASE}/#organization` |
| Sitio | `{BASE}/#website` |
| Profesional | `{BASE}/profesionales/{slug}#person` |
| Artículo | `{BASE}/blog/{slug}#article` |
| Servicio | `{BASE}/servicios/{slug}#service` |

Todo vive en `src/lib/jsonld.js`. La organización y el sitio se describen **una
vez**, en el layout; el resto los referencia.

`Article.author` deja de ser un objeto y pasa a ser `{ "@id": … }` hacia el
perfil. `publisher` e `isPartOf` apuntan a la organización y al sitio.

Los nodos de cada página se agrupan en un solo `@graph`: N scripts sueltos se
leen como N documentos que casualmente están juntos, mientras que un `@graph` con
contexto compartido se lee como lo que es.

### Lo que se agregó a `Person`

`worksFor` hacia la organización —es lo que ata al profesional con la marca en
vez de dejarlo como una persona suelta en internet— y `knowsAbout` con la
disciplina. Los temas concretos saldrán de la taxonomía cuando esté poblada; no
se inventan ahora.

### H-42

`WebSite` con `SearchAction` en el layout, apuntando a `/blog?q=`, que es la
única búsqueda real que existe. Declarar una búsqueda que no funciona sería peor
que no declarar ninguna.

`ItemList` en `/blog`, `/servicios` y `/nosotros`, cada ítem apuntando al `@id`
de su ficha.

---

## 4. Un bug que el grafo destapó

La verificación encontró `https://…/servicios/undefined#service`. La ruta
`/servicios/[slug]` consultaba `where: { slug }` pero **no incluía `slug` en el
`select`**, así que el campo llegaba `undefined` al componente.

No se notaba antes porque nada lo usaba: el `@id` fue el primer consumidor. Es el
tipo de error que solo aparece cuando algo empieza a depender del dato.

---

## 5. Verificación

Se escribió un verificador que sigue cada referencia hasta la página que debería
definirla, en vez de suponer que todo vive en una URL:

```
@id definidos en el sitio: 33
referencias emitidas:      118
referencias rotas:         0
por tipo: Organization 1 · WebSite 1 · ItemList 3 · Person 3 · Article 15 · Service 10
```

Los 33 nodos son exactamente el inventario de contenido. El enlace clave, comprobado:

```
Article  @id      .../blog/logicas-comunes-…#article
         author   { "@id": ".../profesionales/raul-olmedo#person" }
         publisher{ "@id": ".../#organization" }
Person   @id      .../profesionales/raul-olmedo#person
         worksFor { "@id": ".../#organization" }
         hasCredential: sí
```

676 tests, build y lint limpios.

**Lo que no se hizo:** no se pasó por el Rich Results Test de Google ni por el
Schema Markup Validator, que el plan pide. Son herramientas web que requieren la
URL desplegada; conviene correrlas una vez que el deploy esté en línea.

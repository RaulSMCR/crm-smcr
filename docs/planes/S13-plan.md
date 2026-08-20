# S13 · Imágenes

**Estado:** ejecutado el 2026-08-20.
**Hallazgos:** H-33 y H-43 cerrados. H-12 y H-34 acotados — ver §4.
**Riesgo:** medio. Toca lo que se ve.

---

## 1. Lo primero fue comprobar si el problema existía

La auditoría describía un fallback de portada que vive solo del lado del cliente
y por lo tanto es invisible para un crawler sin JavaScript. La memoria del
proyecto registra el episodio en que los buckets de Supabase quedaron privados y
todas las portadas caían al respaldo.

**Se comprobó una por una antes de tocar nada: las 15 portadas y los 10 banners
de servicio devuelven 200 hoy.** El fallback es una red de seguridad, no un
camino que se esté usando. H-12 y H-34 son latentes, no activos, y eso cambia
cuánto vale invertir en ellos.

---

## 2. H-33 · el `alt` describía otra cosa

El `alt` de la portada salía de `coverImageTitle`, que es **el nombre de la obra
para la línea de crédito** —"La noche estrellada"—, no una descripción de lo que
se ve.

Para quien usa lector de pantalla, eso no describe nada: escucha un título que ya
aparece abajo, en el crédito. Como señal para un buscador, tampoco aporta.

`coverImageAlt` es un campo nuevo, con su lugar en los dos editores y una ayuda
que explica la diferencia: *describí la escena, no repitas el título del artículo
ni el nombre de la obra*. Cuando está vacío se cae al título del artículo, que es
impreciso pero no falso.

---

## 3. H-43 · `next/image`, pero no en los treinta y un lugares

El plan decía «migrar `SafeImage` a `next/image`». `SafeImage` se usa **31 veces
en 22 archivos**: avatares, miniaturas de editor, previsualizaciones, banners.

`next/image` exige `fill` o medidas explícitas. Aplicarlo a ciegas sobre avatares
y miniaturas rompe el layout de formas que solo se ven mirando cada pantalla, y
no hay forma de verificar eso desde la terminal.

**Se migraron las portadas grandes y nada más**: el hero del artículo y las
tarjetas del listado. Son las que pesan en Core Web Vitals y las únicas donde
`next/image` cambia algo real. `SafeCover` es el componente nuevo; `SafeImage`
sigue existiendo y sirviendo al resto.

Verificado en el hero: se sirve por `/_next/image`, con `srcSet` en ocho anchos
—de 640 a 3840—, `sizes`, `decoding="async"` y `<link rel="preload">` para el
LCP.

---

## 4. Lo que queda abierto, y por qué

**H-12 y H-34 no están cerrados.** Resolver el fallback del lado del servidor
exigiría comprobar cada URL antes de renderizar —una petición HTTP por imagen en
cada render—, que cuesta más de lo que resuelve mientras las imágenes cargan.

Lo que sí se hizo es dejar el problema acotado: hoy no hay ninguna portada rota, y
el comando para comprobarlo quedó en este documento. Si vuelven a caerse los
buckets, se detecta en un minuto en vez de descubrirse por una portada gris.

**Los otros 29 usos de `SafeImage` siguen con `<img>`.** Migrarlos es trabajo de
revisión visual, no de terminal.

---

## 5. Verificación

- Build limpio, 679 tests.
- Portadas servidas por `/_next/image`, con srcset y preload del LCP.
- `alt` del hero: el texto propio si existe, el título del artículo si no.
- Las 15 portadas y los 10 banners responden 200.

```bash
# Comprobar que ninguna portada esté rota
node -e "require('dotenv').config({path:'.env.local'});const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.post.findMany({select:{slug:true,coverImage:true}}).then(async r=>{for(const x of r){if(!x.coverImage)continue;const h=await fetch(x.coverImage,{method:'HEAD'}).catch(()=>({status:0}));if(h.status!==200)console.log(h.status,x.slug)}}).finally(()=>p.\$disconnect())"
```

---

## 6. Hallazgo nuevo

`BlogPostCard` no se usa en ningún lado. Anotado como HN-06, sin borrar: es de
S15.

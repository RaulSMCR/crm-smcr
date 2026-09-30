// scripts/cargar-hubs-de-tema.mjs
//
// Carga los borradores de hubs de tema que tienen contenido aprobado detrás:
// `docs/hubs-de-tema-borrador.md` (diagnóstico y DSM, psicoanálisis) y
// `docs/hub-ansiedad-borrador.md` (ansiedad).
//
// Lo que NO hace, a propósito:
//   - No publica. Los temas quedan en DRAFT para revisarlos en la vista previa.
//   - No toca `slug` ni `name`: el slug es la URL y renombrar rompe enlaces.
//   - No crea temas: solo escribe sobre los que ya existen.
//
// Es idempotente: correrlo dos veces deja el mismo resultado, no duplica
// secciones, preguntas, artículos ni servicios.
//
// Ojo: vuelve a escribir el texto de cada hub que procesa, así que pisa lo que
// se haya corregido después en el panel. Para cargar uno solo, `--solo`.
//
//   node scripts/cargar-hubs-de-tema.mjs --solo ansiedad --dry   ← muestra qué haría
//   node scripts/cargar-hubs-de-tema.mjs --solo ansiedad         ← escribe ese
//   node scripts/cargar-hubs-de-tema.mjs --dry                    ← todos, sin escribir
//
// Asignar artículos a un tema tiene efecto público aunque el tema siga en
// borrador: el archivo /blog/tema/<slug> aparece con esos artículos y entra al
// sitemap. Correrlo sin --dry es publicar eso.

import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const DRY = process.argv.includes("--dry");
const indiceSolo = process.argv.indexOf("--solo");
const SOLO = indiceSolo > -1 ? process.argv[indiceSolo + 1] : null;

/**
 * El texto se exporta para poder cotejarlo contra
 * `docs/hubs-de-tema-borrador.md`, que es lo que Raúl revisa. Si alguien edita
 * uno y no el otro, el cotejo lo delata.
 */
export const HUBS = [
  {
    slug: "diagnostico-y-dsm",
    identidad: {
      title: "Diagnóstico y DSM",
      subtitle: "Qué nombra un diagnóstico, qué ordena una clasificación y qué queda afuera",
      excerpt:
        "Un diagnóstico no describe algo que estaba ahí esperando ser visto: lo recorta. Estos ensayos siguen cómo se formó esa manera de clasificar —del encierro a la clínica, de la clínica al código— y qué se gana y qué se pierde cuando un nombre cierra la pregunta en lugar de abrirla.",
      metaTitle: "Diagnóstico y DSM en salud mental",
      metaDescription:
        "Qué es el DSM, para qué sirve un diagnóstico y qué deja afuera. Ensayos de profesionales colegiados en Costa Rica, no consejos rápidos.",
    },
    secciones: [
      {
        type: "EDITORIAL_INTRO",
        title: "De dónde viene el diagnóstico",
        position: 0,
        body: [
          "El DSM es un manual de clasificación, no un mapa del sufrimiento. Ordena lo que se observa en categorías que permiten que dos profesionales en dos países distintos hablen de lo mismo, que un seguro autorice un tratamiento y que una investigación compare resultados. Eso no es poco, y explica por qué existe.",
          "El problema aparece cuando la categoría deja de ser una herramienta y pasa a ser una identidad. Un nombre que servía para ordenar la conversación entre profesionales termina usándose para cerrarla: *ya sé lo que tengo*. Lo que se gana en precisión administrativa se pierde en la pregunta por lo singular, que es donde una clínica trabaja.",
          "Los ensayos de esta página no toman partido por el diagnóstico ni contra él. Reconstruyen de dónde viene: cómo el encierro, el derecho y la medicina se cruzaron para producir instituciones que protegían mientras clasificaban; cómo el siglo XX superpuso interpretar, medicar y codificar sin que ninguna de las tres desplazara a las otras; y por qué ninguna disciplina sola alcanza para sostener lo que se le pide a la salud mental.",
          "No hay acá una lista de síntomas para reconocerse. Hay la historia de una manera de nombrar, y las razones para usarla con cuidado.",
        ].join("\n\n"),
      },
      // «Artículos destacados» solo aparece si alguna entrada está marcada como
      // destacada, y hoy ninguna lo está: el listado sale bajo «Explorar este
      // tema». Por eso el título bueno va en ésa, y la otra queda preparada.
      { type: "FEATURED_ARTICLES", title: "Para empezar", position: 1, body: null },
      { type: "EXPLORE_TOPIC", title: "Los ensayos", position: 2, body: null },
    ],
    faqs: [
      {
        question: "¿Necesito un diagnóstico para empezar una psicoterapia?",
        answer:
          "No. Una consulta empieza por lo que a alguien le pasa y por lo que quiere hacer con eso. El diagnóstico, cuando hace falta, aparece en el trabajo; no es el requisito de entrada.",
      },
      {
        question: "¿El DSM es lo mismo que la psicología?",
        answer:
          "No. Es un manual de clasificación de origen psiquiátrico, usado también en investigación y en seguros. Hay escuelas de psicoterapia que trabajan con él y otras que no organizan su práctica alrededor de sus categorías.",
      },
      {
        question: "¿Un diagnóstico es para siempre?",
        answer:
          "Las clasificaciones cambian de edición en edición: categorías que existieron desaparecieron, y otras aparecieron. Conviene leer un diagnóstico como una descripción situada, no como una propiedad de la persona.",
      },
    ],
  },
  {
    slug: "psicoanalisis",
    identidad: {
      title: "Psicoanálisis",
      subtitle: "Una escuela entre varias: de qué trata, qué sostiene y a qué discusiones responde",
      excerpt:
        "El psicoanálisis es una de las escuelas de la psicoterapia, no su sinónimo ni su contrario. Estos ensayos lo ubican entre las demás: de qué parte, qué supone sobre lo que le pasa a alguien, y a qué discusiones —dentro y fuera de la clínica— viene respondiendo.",
      metaTitle: "Psicoanálisis en Costa Rica",
      metaDescription:
        "Qué es el psicoanálisis, cómo se practica y qué discute. Ensayos de profesionales colegiados en Costa Rica y consulta en línea o presencial.",
    },
    secciones: [
      {
        type: "EDITORIAL_INTRO",
        title: "Una escuela entre varias",
        position: 0,
        body: [
          "Quien busca psicoterapia se encuentra con una lista de nombres —psicoanálisis, cognitivo-conductual, sistémica, humanista— y con muy poca ayuda para entenderlos. La elección suele terminar decidiéndose por precio, por disponibilidad o por cuál apareció primero en una búsqueda.",
          "El psicoanálisis es una de esas escuelas. Parte de una apuesta: que lo que a alguien le pasa no siempre está disponible para él mismo, y que hablar bajo ciertas condiciones produce algo que no se consigue explicando. De ahí vienen sus rasgos reconocibles —la frecuencia, la duración, la atención a lo que se dice sin querer decirlo— que a veces se leen como capricho y son consecuencia de esa apuesta.",
          "No es la única manera de trabajar ni la mejor para todo el mundo. Los ensayos de esta página sirven para orientarse: qué distingue a la psicoterapia de otras ofertas que se le parecen, qué sostiene cada familia de escuelas, y por qué la psicología que circula en redes —la que presta un nombre para cerrar una pregunta en vez de abrirla— no es equivalente a ninguna de ellas.",
          "Si después de leer alguien quiere consultar, abajo está cómo. Si quiere seguir leyendo, también.",
        ].join("\n\n"),
      },
      { type: "FEATURED_ARTICLES", title: "Para empezar", position: 1, body: null },
      { type: "EXPLORE_TOPIC", title: "Los ensayos", position: 2, body: null },
    ],
    faqs: [
      {
        question: "¿En qué se diferencia el psicoanálisis de otras psicoterapias?",
        answer:
          "En de dónde parte y en qué espera del trabajo. Las otras escuelas tienen respuestas distintas y legítimas a las mismas preguntas; la serie sobre escuelas las recorre una por una.",
      },
      {
        question: "¿Cuánto dura un psicoanálisis?",
        answer:
          "No hay un número. Depende de qué se vaya a trabajar y de lo que la persona quiera hacer con eso. Cualquier cifra prometida de antemano —seis sesiones, doce— es una promesa comercial, no clínica.",
      },
      {
        question: "¿Sirve en línea?",
        answer: "Sí, y es la modalidad principal del sitio. Lo que cambia es el encuadre, no la práctica.",
      },
    ],
  },
  {
    // Borrador en docs/hub-ansiedad-borrador.md. Es el «hub de ansiedad de SMCR»
    // al que la página de consulta de Raúl manda para entender el término: acá
    // se busca entender, allá consultar, y no compiten por la misma búsqueda.
    slug: "ansiedad",
    identidad: {
      title: "Ansiedad y angustia",
      subtitle: "Qué nombra cada palabra, de dónde viene la confusión y cómo se trabaja en consulta",
      excerpt:
        "En castellano, lo que aprieta tiene dos nombres. Ansiedad es el de los manuales, las escalas y las redes; angustia, el que conserva la clínica y el que viene de lo angosto. Estos ensayos siguen de dónde salen esas palabras y qué se pierde cuando todo se llama igual.",
      metaTitle: "Ansiedad y angustia: la diferencia",
      metaDescription:
        "Qué distingue la ansiedad de la angustia, de dónde vienen las dos palabras y cómo se trabaja en consulta, en línea desde Costa Rica.",
    },
    secciones: [
      {
        type: "EDITORIAL_INTRO",
        title: "Dos nombres para lo que aprieta",
        position: 0,
        body: [
          "Casi todo malestar se llama hoy ansiedad. Es la palabra de los manuales, de las escalas y de las redes, y sirve para empezar a hablar. Tiene una ventaja y un costo: se puede medir —mucha, poca, siete sobre diez— y, justamente por eso, dice poco de qué se trata.",
          "El castellano tiene otra palabra, más vieja, para lo mismo y no exactamente lo mismo: angustia. Viene del latín *angustus*, estrecho, y es la misma palabra que angosto; ansiedad sale de la misma raíz, la del verbo que quería decir apretar. Lo que esas palabras nombraron durante siglos no fue una cantidad sino una forma: la del paso que se cierra.",
          "Cuando se tradujo a Freud, la *Angst* alemana pasó al inglés como *anxiety* y al castellano, casi siempre, como *angustia*. Por eso en español conviven dos nombres donde otras lenguas tienen uno, y por eso la diferencia no es un capricho de especialistas: la ansiedad describe bien el costado medible —el cuerpo, la activación, lo que puntúa una escala—; la angustia, en la clínica psicoanalítica, nombra aquello a lo que ese costado responde.",
          "Los ensayos de esta página recorren esa historia: de dónde vienen las palabras del malestar, por qué el castellano lo ordenó en familias corporales y no en grados, y cómo lenguas sin contacto entre sí llegaron a la misma imagen del pecho estrecho. No hay acá una lista de síntomas para reconocerse.",
          "Si lo que buscás es consultar, en [Terapia para la ansiedad](/raul-olmedo-evans/terapia-para-la-ansiedad) está cómo se trabaja en un tratamiento. Si querés seguir leyendo, los ensayos están abajo.",
        ].join("\n\n"),
      },
      // El primer ensayo va como PRIMARY, que es lo que lo pone en «destacados»;
      // los otros dos salen en «explorar».
      { type: "FEATURED_ARTICLES", title: "Para empezar", position: 1, body: null },
      { type: "EXPLORE_TOPIC", title: "Seguir leyendo", position: 2, body: null },
      {
        type: "CTA",
        title: "Podés empezar por donde te resulte posible",
        position: 3,
        body: "Si ya sabés que querés consultar, en [Terapia para la ansiedad](/raul-olmedo-evans/terapia-para-la-ansiedad) está cómo trabaja Raúl Olmedo Evans, con qué formato y a qué precio. Los servicios y perfiles del equipo con agenda abierta están más arriba.",
      },
    ],
    faqs: [
      {
        question: "¿Ansiedad y angustia son lo mismo?",
        answer:
          "En el habla cotidiana se usan como sinónimos, y no está mal: vienen de la misma raíz latina, la de apretar. En la clínica conviene separarlas. Ansiedad nombra bien lo que se puede observar y medir —el cuerpo acelerado, la preocupación, lo que puntúa una escala—; angustia, en la tradición psicoanalítica, nombra aquello a lo que esa reacción responde.",
      },
      {
        question: "¿Un test en línea puede decir si tengo ansiedad?",
        answer:
          "No. Un cuestionario bien construido sirve para ordenar una consulta y para medir cambios en el tiempo, pero no diagnostica. Eso se establece en consulta, con una persona profesional, y lleva más de tres minutos.",
      },
      {
        question: "¿La terapia para la ansiedad puede hacerse en línea?",
        answer:
          "Sí. Las sesiones en línea permiten consultar desde cualquier lugar de Costa Rica o desde fuera del país. Lo que cambia es el encuadre, no el trabajo.",
      },
      {
        question: "¿Con qué enfoques se trabaja?",
        answer:
          "En el equipo hay psicoterapia psicoanalítica y psicoterapia cognitivo-conductual. Parten de supuestos distintos sobre lo que le pasa a alguien y no compiten entre sí; la serie del blog sobre escuelas de psicoterapia ayuda a orientarse entre ellas. Cuando corresponde una evaluación psiquiátrica, se indica.",
      },
      {
        question: "¿Qué hago si no puedo esperar a una cita?",
        answer:
          "Si sentís que no podés sostener lo que te está pasando, eso no espera a una cita. En la página Ayuda inmediata del sitio están el 911 y las líneas de atención disponibles en Costa Rica.",
      },
    ],
    // Los tres ensayos publicados de «La angustia y sus formas». Son los únicos
    // del blog que tratan el tema de lleno (entre 11 y 17 menciones de
    // «angustia» cada uno; ningún otro pasa de una).
    articulos: [
      { slug: "angustia-y-angosto-misma-raiz", role: "PRIMARY", featured: false, position: 0 },
      { slug: "familias-del-malestar-terror-horror-pavor", role: "SUPPORTING", featured: false, position: 1 },
      { slug: "angustia-hebreo-arabe-estrechez-del-pecho", role: "SUPPORTING", featured: false, position: 2 },
    ],
    // Los dos servicios del equipo que trabajan la ansiedad y hoy tienen
    // profesionales aprobados. Psiquiatría queda afuera mientras no tenga a nadie.
    servicios: [
      { slug: "psicoterapia-psicoanalitica-adultos", featured: true, position: 0 },
      { slug: "psicoterapia-cognitivo-conductual", featured: false, position: 1 },
    ],
  },
];

const acciones = [];
const anotar = (texto) => { acciones.push(texto); console.log(`  ${texto}`); };

async function cargar(prisma, hub) {
  const tema = await prisma.topic.findUnique({
    where: { slug: hub.slug },
    select: { id: true, name: true, slug: true, status: true, title: true, metaTitle: true },
  });
  if (!tema) {
    console.log(`\n/${hub.slug}\n  NO EXISTE — se omite (este script no crea temas).`);
    return;
  }

  console.log(`\n/${hub.slug}  «${tema.name}»  estado actual: ${tema.status}`);
  if (tema.status !== "DRAFT") {
    console.log("  ATENCIÓN: no está en borrador. Se escribe igual, pero revisá antes de tocar algo publicado.");
  }

  // Identidad. `status`, `slug` y `name` quedan intactos a propósito.
  anotar(`identidad: ${Object.keys(hub.identidad).join(", ")}${tema.title ? "  (sobrescribe lo que hubiera)" : ""}`);
  if (!DRY) await prisma.topic.update({ where: { id: tema.id }, data: hub.identidad });

  // Secciones: una por tipo. Si ya existe, se actualiza en vez de duplicar.
  for (const seccion of hub.secciones) {
    const existente = await prisma.topicSection.findFirst({
      where: { topicId: tema.id, type: seccion.type },
      select: { id: true },
    });
    anotar(`sección ${seccion.type.padEnd(18)} ${existente ? "actualizada" : "creada"}  «${seccion.title}»`);
    if (DRY) continue;
    const datos = { title: seccion.title, body: seccion.body, position: seccion.position, isVisible: true };
    if (existente) await prisma.topicSection.update({ where: { id: existente.id }, data: datos });
    else await prisma.topicSection.create({ data: { topicId: tema.id, type: seccion.type, ...datos } });
  }

  // Preguntas frecuentes: se identifican por su texto.
  for (const [indice, faq] of hub.faqs.entries()) {
    const existente = await prisma.topicFaq.findFirst({
      where: { topicId: tema.id, question: faq.question },
      select: { id: true },
    });
    anotar(`FAQ ${existente ? "actualizada" : "creada"}: «${faq.question}»`);
    if (DRY) continue;
    const datos = { answer: faq.answer, position: indice, isVisible: true };
    if (existente) await prisma.topicFaq.update({ where: { id: existente.id }, data: datos });
    else await prisma.topicFaq.create({ data: { topicId: tema.id, question: faq.question, ...datos } });
  }

  // Artículos: solo publicados, y la asignación entra aprobada. Un slug que no
  // está publicado se informa y se salta: no se asigna un borrador a un hub.
  for (const articulo of hub.articulos || []) {
    const post = await prisma.post.findFirst({
      where: { slug: articulo.slug, status: "PUBLISHED" },
      select: { id: true, title: true },
    });
    if (!post) {
      anotar(`artículo /blog/${articulo.slug}: NO está publicado — se omite`);
      continue;
    }
    const datos = { status: "APPROVED", role: articulo.role, featured: articulo.featured, position: articulo.position };
    anotar(`artículo ${articulo.role.padEnd(10)} «${post.title}»`);
    if (DRY) continue;
    await prisma.postTopic.upsert({
      where: { postId_topicId: { postId: post.id, topicId: tema.id } },
      create: { postId: post.id, topicId: tema.id, ...datos },
      update: datos,
    });
  }

  // Servicios: solo activos. Los profesionales del hub salen solos de estos.
  for (const servicio of hub.servicios || []) {
    const registro = await prisma.service.findFirst({
      where: { slug: servicio.slug, isActive: true },
      select: { id: true, title: true },
    });
    if (!registro) {
      anotar(`servicio /servicios/${servicio.slug}: NO está activo — se omite`);
      continue;
    }
    const datos = { featured: servicio.featured, position: servicio.position };
    anotar(`servicio «${registro.title}»${servicio.featured ? " (destacado)" : ""}`);
    if (DRY) continue;
    await prisma.topicService.upsert({
      where: { topicId_serviceId: { topicId: tema.id, serviceId: registro.id } },
      create: { topicId: tema.id, serviceId: registro.id, ...datos },
      update: datos,
    });
  }
}

async function main() {
  const elegidos = SOLO ? HUBS.filter((hub) => hub.slug === SOLO) : HUBS;
  if (SOLO && !elegidos.length) {
    console.log(`--solo ${SOLO}: no hay un borrador con ese slug. Hay: ${HUBS.map((hub) => hub.slug).join(", ")}.`);
    return;
  }
  const prisma = new PrismaClient();
  console.log(DRY ? "-- PRUEBA: no se escribe nada --" : "-- ESCRIBIENDO EN LA BASE --");
  try {
    for (const hub of elegidos) await cargar(prisma, hub);
    console.log(`
${acciones.length} operaciones ${DRY ? "pendientes" : "aplicadas"}.`);
    console.log("Los temas siguen en BORRADOR: publicarlos es un acto aparte, desde el panel.");
  } finally {
    await prisma.$disconnect();
  }
}

// Solo corre cuando se lo invoca directamente. Importarlo —para cotejar el
// texto contra el documento— no debe tocar la base.
const invocadoDirecto =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invocadoDirecto) await main();

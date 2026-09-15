// scripts/cargar-hubs-de-tema.mjs
//
// Carga el borrador de `docs/hubs-de-tema-borrador.md` en los dos hubs de tema
// que tienen contenido aprobado detrás.
//
// Lo que NO hace, a propósito:
//   - No publica. Los temas quedan en DRAFT para revisarlos en la vista previa.
//   - No toca `slug` ni `name`: el slug es la URL y renombrar rompe enlaces.
//   - No crea temas: solo escribe sobre los que ya existen.
//
// Es idempotente: correrlo dos veces deja el mismo resultado, no duplica
// secciones ni preguntas.
//
//   node scripts/cargar-hubs-de-tema.mjs --dry    ← muestra qué haría
//   node scripts/cargar-hubs-de-tema.mjs          ← escribe

import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const DRY = process.argv.includes("--dry");

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
}

async function main() {
  const prisma = new PrismaClient();
  console.log(DRY ? "-- PRUEBA: no se escribe nada --" : "-- ESCRIBIENDO EN LA BASE --");
  try {
    for (const hub of HUBS) await cargar(prisma, hub);
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

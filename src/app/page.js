import { prisma } from "@/lib/prisma";
import HeroSection from "@/components/HeroSection";
import HomeServicesAndBlog from "@/components/HomeServicesAndBlog";
import HomeTeamBand from "@/components/HomeTeamBand";
import MissionVideo from "@/components/MissionVideo";
import HomeFeatureCarousel from "@/components/HomeFeatureCarousel";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";
import JsonLd from "@/components/JsonLd";
import { buildMetadata } from "@/lib/seo";
import { fallarSiEsBuild, enPrerender } from "@/lib/prisma-safe";

export const metadata = buildMetadata({
  title: "Psicoterapia y salud mental en Costa Rica | En línea y presencial",
  description:
    "Agendá consulta con especialistas colegiados: psicoterapia, nutrición y terapia física, en línea o presencial. Informate sobre temas de salud mental.",
  path: "",
});

const STOCK_IMAGES = [
  "https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80",
  "https://images.unsplash.com/photo-1543352634-8730b6e7a88a?w=1600&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80",
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80",
];

// Categorías de respaldo, para cuando la base no responde en una petición real.
//
// Los slugs eran "psico", "nutri" y "coach", que no corresponden a ningún
// servicio: la home degradada enlazaba a tres 404. Ahora usan slugs reales, que
// desde S6 son estables. Y se va la categoría que no corresponde a ninguno de
// los servicios que realmente se ofrecen.
const FALLBACK_CATEGORIES = [
  { name: "Psicoterapia", slug: "psicoterapia-psicoanalitica-adultos", description: "Un espacio para hablar y pensar lo que duele.", imageUrl: STOCK_IMAGES[0] },
  { name: "Nutrición", slug: "nutricion", description: "Acompañamiento en la alimentación.", imageUrl: STOCK_IMAGES[1] },
  { name: "Terapia física y deporte", slug: "terapia-fisica-y-deporte", description: "Movimiento, dolor y rehabilitación.", imageUrl: STOCK_IMAGES[2] },
];

export const revalidate = 300;

function summarizeText(value, maxLength = 260) {
  const text = String(value || "")
    .replace(/[#*_>`~\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function normalizeCarouselItems(items = []) {
  return items
    .map((item) => {
      if (String(item.kind || "").startsWith("ARTICLE")) {
        const post = item.post;
        if (!post || post.status !== "PUBLISHED") return null;

        return {
          id: item.id,
          kind: item.kind,
          label: item.label || "",
          article: {
            slug: post.slug,
            title: post.title,
            summary: summarizeText(post.excerpt || post.content),
            image: post.coverImage || "",
            focusX: post.coverImageFocusX ?? 50,
            focusY: post.coverImageFocusY ?? 50,
            scale: post.coverImageScale ?? 100,
            author: {
              name: post.author?.user?.name || "Redacción",
              image: post.author?.user?.image || "",
              specialty: post.author?.specialty || "",
              slug: post.author?.slug || "",
            },
          },
        };
      }

      const professional = item.professional;
      if (!professional || !professional.isApproved || !professional.user?.isActive) return null;

      return {
        id: item.id,
        kind: item.kind,
        label: item.label || "",
        professional: {
          id: professional.id,
          slug: professional.slug,
          name: professional.user?.name || "Profesional",
          image: professional.user?.image || "",
          specialty: professional.specialty || "",
          licenseNumber: professional.licenseNumber || "",
          review: summarizeText(professional.profileReview, 360),
          services: (professional.serviceAssignments || [])
            .map((assignment) => assignment.service)
            .filter(Boolean),
        },
      };
    })
    .filter(Boolean);
}

export default async function HomePage() {
  let categoriesToShow = FALLBACK_CATEGORIES;
  let carouselItems = [];
  // El índice del blog y la banda del equipo no tienen respaldo estático a
  // propósito: si la base no responde, sus componentes no se dibujan. Inventar
  // artículos o personas que quizá no existan sería peor que no mostrarlos.
  let latestPosts = [];
  let teamMembers = [];

  try {
    // Dos grupos con presupuestos separados, y no uno solo, porque no todo pesa
    // igual. Los servicios y el carrusel SON la home: si no llegan hay que
    // degradar, y en el build hay que fallar. El índice del blog y la banda del
    // equipo son accesorios; que tarden no puede costarle la home a nadie.
    //
    // Importa que el pool es de una sola conexión: las consultas no corren en
    // paralelo aunque se lancen juntas, se encolan. Meter las cuatro en un solo
    // `Promise.all` con un solo límite hacía que las dos accesorias empujaran a
    // las críticas fuera del presupuesto y la home entera cayera al respaldo.
    const consultasCriticas = Promise.all([
      prisma.service.findMany({
        take: 4,
        orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          bannerImage: true,
          bannerFocusX: true,
          bannerFocusY: true,
          bannerScale: true,
          bannerArtworkTitle: true,
          bannerArtworkAuthor: true,
          bannerArtworkNote: true,
        },
      }),
      prisma.homeCarouselItem.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        take: 16,
        select: {
          id: true,
          kind: true,
          label: true,
          post: {
            select: {
              slug: true,
              title: true,
              content: true,
              excerpt: true,
              coverImage: true,
              coverImageFocusX: true,
              coverImageFocusY: true,
              coverImageScale: true,
              status: true,
              author: {
                select: {
                  slug: true,
                  specialty: true,
                  user: { select: { name: true, image: true } },
                },
              },
            },
          },
          professional: {
            select: {
              id: true,
              slug: true,
              specialty: true,
              licenseNumber: true,
              profileReview: true,
              isApproved: true,
              user: { select: { name: true, image: true, isActive: true } },
              serviceAssignments: {
                take: 3,
                where: {
                  status: "APPROVED",
                  service: { is: { isActive: true } },
                },
                select: {
                  service: { select: { id: true, title: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // Función y no promesa: las accesorias no se lanzan hasta que las críticas
    // terminaron. Lanzadas a la vez no solo se encolan, contienden — medido
    // contra la base real, las cuatro juntas tardan más que las dos críticas
    // solas y arrastraban la home entera al respaldo. Que el índice del blog
    // llegue tarde es aceptable; que los servicios no lleguen, no.
    const pedirAccesorias = () => Promise.all([
      // Los cuatro más recientes: la columna angosta es un índice de novedad,
      // no una curaduría. La curaduría ya tiene su lugar en el carrusel, que se
      // arma a mano desde el panel.
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 4,
        select: {
          slug: true,
          title: true,
          createdAt: true,
          author: { select: { user: { select: { name: true } } } },
        },
      }),
      // Cinco es el equipo completo de hoy, así que la banda no deja a nadie
      // afuera. Si el equipo crece pasa a ser una muestra por antigüedad, y el
      // enlace a /profesionales carga con el resto.
      prisma.professionalProfile.findMany({
        where: { isApproved: true, user: { is: { isActive: true } } },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: {
          id: true,
          slug: true,
          specialty: true,
          licenseNumber: true,
          user: { select: { name: true, image: true } },
        },
      }),
    ]);

    // El límite de 4 s existe para que un visitante no espere a una base lenta.
    // En el build no hay nadie esperando, y sí hay quince workers consultando a
    // la vez: aplicarlo ahí solo produce fallas por contención propia.
    const PRESUPUESTO_MS = 4000;

    const [dbServices, dbCarouselItems] = enPrerender()
      ? await consultasCriticas
      : await Promise.race([
          consultasCriticas,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout DB")), PRESUPUESTO_MS);
          }),
        ]);

    // Las accesorias tienen su propio presupuesto y vencen resolviendo vacío en
    // lugar de rechazar: un índice que no llegó a tiempo no puede tumbar la home
    // ni hacer fallar el build. El catch cubre el otro caso —que la consulta
    // falle, no que tarde— por la misma razón.
    const [dbPosts, dbProfessionals] = await (enPrerender()
      ? pedirAccesorias()
      : Promise.race([
          pedirAccesorias(),
          new Promise((resolve) => {
            setTimeout(() => resolve([[], []]), PRESUPUESTO_MS);
          }),
        ])
    ).catch(() => [[], []]);

    if (dbServices && dbServices.length > 0) {
      categoriesToShow = dbServices.map((service, index) => ({
        name: service.title,
        slug: service.slug,
        description: service.description || "Servicio profesional.",
        imageUrl: service.bannerImage || STOCK_IMAGES[index % STOCK_IMAGES.length],
        imagePosition: `${service.bannerFocusX ?? 50}% ${service.bannerFocusY ?? 50}%`,
        imageScale: service.bannerScale ?? 100,
        artworkTitle: service.bannerArtworkTitle || "",
        artworkAuthor: service.bannerArtworkAuthor || "",
        artworkNote: service.bannerArtworkNote || "",
      }));
    }

    carouselItems = normalizeCarouselItems(dbCarouselItems);

    // `createdAt` se serializa acá. El índice es un componente de servidor y
    // podría recibir el Date crudo, pero eso lo ataría a seguir siéndolo.
    latestPosts = (dbPosts || []).map((post) => ({
      slug: post.slug,
      title: post.title,
      authorName: post.author?.user?.name || "Redacción",
      createdAt: post.createdAt ? post.createdAt.toISOString() : null,
    }));

    teamMembers = (dbProfessionals || []).map((professional) => ({
      id: professional.id,
      slug: professional.slug || "",
      name: professional.user?.name || "Profesional",
      image: professional.user?.image || "",
      specialty: professional.specialty || "",
      licenseNumber: professional.licenseNumber || "",
    }));
  } catch (error) {
    // En una petición real la home degrada a las categorías por defecto y sigue
    // en pie, que es lo que corresponde. En el build, no: ese estado degradado
    // se hornea en el HTML estático y se sirve con 200 hasta que revalide.
    fallarSiEsBuild(error, "/");
    console.error("La base de datos fallo, pero la web sigue viva:", error);
  }

  return (
    <div>
      {/* Acá había un nodo `MedicalBusiness` con name, url y
          `medicalSpecialty: "Salud mental"`. Se sacó por tres razones.

          Era una TERCERA descripción de la misma organización, suelta y sin
          `@id`: exactamente la fragmentación que S8 vino a eliminar. La
          organización ya está descrita una vez en el layout, con su `@id`.

          `medicalSpecialty` espera un miembro del enum `MedicalSpecialty`
          (Psychiatric, Cardiovascular, …), no texto libre. El validador de
          schema.org lo rechazaba: "Salud mental" no es un valor válido.

          Y `MedicalBusiness` sobredeclara, por el mismo motivo por el que el
          plan descartó `Physician` para H-24: el equipo son psicólogos,
          nutricionistas y pedagogos. Declararse negocio médico es una
          afirmación que la mayoría del equipo no sostiene.

          Si en algún momento se quiere SEO local —aparecer en el mapa—, eso
          pide un `LocalBusiness` con dirección, coordenadas y horario reales,
          que es otra decisión y otros datos. */}
      <HeroSection />
      <MissionVideo />
      <HomeFeatureCarousel items={carouselItems} />
      <HomeServicesAndBlog categories={categoriesToShow} posts={latestPosts} />
      <HomeTeamBand professionals={teamMembers} />
      <ProfessionalCtaSection />
    </div>
  );
}

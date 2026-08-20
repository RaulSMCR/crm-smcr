import { prisma } from "@/lib/prisma";
import Link from "next/link";
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import MissionVideo from "@/components/MissionVideo";
import HomeFeatureCarousel from "@/components/HomeFeatureCarousel";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";
import JsonLd from "@/components/JsonLd";
import { buildMetadata } from "@/lib/seo";
import { fallarSiEsBuild, enPrerender } from "@/lib/prisma-safe";

export const metadata = buildMetadata({
  title: "Salud Mental Costa Rica — Bienestar con profesionales validados",
  description:
    "Plataforma interdisciplinaria de bienestar y salud mental en Costa Rica. Psicología, nutrición, deporte y más. Consultas virtuales y presenciales con profesionales verificados.",
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

  try {
    const dbPromise = Promise.all([
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

    // El límite de 4 s existe para que un visitante no espere a una base lenta.
    // En el build no hay nadie esperando, y sí hay quince workers consultando a
    // la vez: aplicarlo ahí solo produce fallas por contención propia.
    const [dbServices, dbCarouselItems] = enPrerender()
      ? await dbPromise
      : await Promise.race([
          dbPromise,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout DB")), 4000);
          }),
        ]);

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
      <CategorySection categories={categoriesToShow} title="Nuestros Servicios" />
      <div className="bg-surface px-4 pb-16">
        <div className="container mx-auto flex justify-center">
          <Link
            href="/servicios"
            className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-card hover:bg-brand-800"
          >
            Otros servicios
          </Link>
        </div>
      </div>
      <ProfessionalCtaSection />
    </div>
  );
}

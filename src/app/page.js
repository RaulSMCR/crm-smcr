import { prisma } from "@/lib/prisma";
import Link from "next/link";
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import MissionVideo from "@/components/MissionVideo";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";

const STOCK_IMAGES = [
  "https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80",
  "https://images.unsplash.com/photo-1543352634-8730b6e7a88a?w=1600&q=80",
  "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80",
  "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80",
];

const FALLBACK_CATEGORIES = [
  { name: "Psicologia", slug: "psico", description: "Ayuda profesional.", imageUrl: STOCK_IMAGES[0] },
  { name: "Nutricion", slug: "nutri", description: "Alimentacion sana.", imageUrl: STOCK_IMAGES[1] },
  { name: "Coaching", slug: "coach", description: "Avance hacia metas concretas.", imageUrl: STOCK_IMAGES[2] },
];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  let categoriesToShow = FALLBACK_CATEGORIES;

  try {
    const dbPromise = prisma.service.findMany({
      take: 4,
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
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
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout DB")), 4000);
    });

    const dbServices = await Promise.race([dbPromise, timeoutPromise]);

    if (dbServices && dbServices.length > 0) {
      categoriesToShow = dbServices.map((service, index) => ({
        name: service.title,
        slug: service.id,
        description: service.description || "Servicio profesional.",
        imageUrl: service.bannerImage || STOCK_IMAGES[index % STOCK_IMAGES.length],
        imagePosition: `${service.bannerFocusX ?? 50}% ${service.bannerFocusY ?? 50}%`,
        imageScale: service.bannerScale ?? 100,
        artworkTitle: service.bannerArtworkTitle || "",
        artworkAuthor: service.bannerArtworkAuthor || "",
        artworkNote: service.bannerArtworkNote || "",
      }));
    }
  } catch (error) {
    console.error("La base de datos fallo, pero la web sigue viva:", error);
  }

  return (
    <div>
      <HeroSection />
      <MissionVideo />
      <CategorySection categories={categoriesToShow} title="Nuestros Servicios" />
      <div className="bg-appbg px-4 pb-16">
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

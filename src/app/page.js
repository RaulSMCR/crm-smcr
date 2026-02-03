// src/app/page.js
import { prisma } from '@/lib/prisma';
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import MissionVideo from "@/components/MissionVideo";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";

// Imágenes de stock para decorar (backup)
const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80',
  'https://images.unsplash.com/photo-1543352634-8730b6e7a88a?w=1600&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80',
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80',
];

// Configuración vital para evitar timeouts en Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  let categoriesToShow = undefined; // Por defecto undefined -> Carga datos de ejemplo

  try {
    // 1. Intentamos conectar a la BD con protección
    const dbServices = await prisma.service.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' }
    });

    // 2. Si la BD responde y tiene datos, los transformamos
    if (dbServices && dbServices.length > 0) {
      categoriesToShow = dbServices.map((service, index) => ({
        name: service.title,
        slug: service.id, 
        description: service.description || "Servicio profesional especializado.",
        imageUrl: STOCK_IMAGES[index % STOCK_IMAGES.length]
      }));
    }

  } catch (error) {
    // 3. SI FALLA LA BD: No rompemos la página.
    // Solo registramos el error en la consola del servidor y seguimos.
    console.error("⚠️ Error cargando servicios en Home (Usando Fallback):", error.message);
    // categoriesToShow se mantiene undefined, así que CategorySection usará sus datos por defecto.
  }

  return (
    <div>
      <HeroSection />
      <MissionVideo />
      
      {/* CategorySection es inteligente: si recibe undefined, muestra sus propios datos */}
      <CategorySection categories={categoriesToShow} title="Nuestros Servicios" />
      
      <ProfessionalCtaSection />
    </div>
  );
}
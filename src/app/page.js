// src/app/page.js
import { prisma } from '@/lib/prisma';
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import MissionVideo from "@/components/MissionVideo";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";

// Imágenes de stock de respaldo
const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80',
  'https://images.unsplash.com/photo-1543352634-8730b6e7a88a?w=1600&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80',
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80',
];

// Configuración vital para Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  let categoriesToShow = undefined;

  try {
    // TÉCNICA DE CORTOCIRCUITO:
    // Creamos una promesa que falla a los 3 segundos
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve(null), 3000);
    });

    // La consulta real a la base de datos
    const dbPromise = prisma.service.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' }
    });

    // Promise.race toma el que termine primero. 
    // Si la BD tarda más de 3s, gana el timeout y la página carga igual.
    const dbServices = await Promise.race([dbPromise, timeoutPromise]);

    if (dbServices && dbServices.length > 0) {
      categoriesToShow = dbServices.map((service, index) => ({
        name: service.title,
        slug: service.id, 
        description: service.description || "Servicio profesional especializado.",
        imageUrl: STOCK_IMAGES[index % STOCK_IMAGES.length]
      }));
    } else {
      console.log("⚠️ La DB tardó demasiado o no tiene datos. Usando fallback.");
    }

  } catch (error) {
    console.error("⚠️ Error crítico en Home:", error);
    // categoriesToShow se queda undefined, cargando los datos por defecto
  }

  return (
    <div>
      <HeroSection />
      <MissionVideo />
      
      {/* Si categoriesToShow es undefined, muestra Psicología, Nutrición, etc. */}
      <CategorySection categories={categoriesToShow} title="Nuestros Servicios" />
      
      <ProfessionalCtaSection />
    </div>
  );
}

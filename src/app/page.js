// src/app/page.js
import { prisma } from '@/lib/prisma';
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection"; // Este es el componente visual
import MissionVideo from "@/components/MissionVideo";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";

// Imágenes de stock para decorar
const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80',
  'https://images.unsplash.com/photo-1543352634-8730b6e7a88a?w=1600&q=80',
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80',
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80',
];

// Datos de RESPALDO (Por si la base de datos explota)
const FALLBACK_CATEGORIES = [
  { name: 'Psicología', slug: 'psico', description: 'Ayuda profesional.', imageUrl: STOCK_IMAGES[0] },
  { name: 'Nutrición', slug: 'nutri', description: 'Alimentación sana.', imageUrl: STOCK_IMAGES[1] },
  { name: 'Coaching', slug: 'coach', description: 'Logra tus metas.', imageUrl: STOCK_IMAGES[2] },
];

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  let categoriesToShow = FALLBACK_CATEGORIES; // Empezamos asumiendo lo peor (Fallback)

  try {
    // Intentamos conectar a la BD con un límite de tiempo (timeout artificial)
    // Si tarda más de 3 segundos, lo consideramos fallido para no colgar la web
    const dbPromise = prisma.service.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' }
    });

    // Truco ninja: Cortar la conexión si tarda mucho
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout DB")), 4000)
    );

    const dbServices = await Promise.race([dbPromise, timeoutPromise]);

    // Si llegamos aquí, la BD respondió rápido y bien
    if (dbServices && dbServices.length > 0) {
      categoriesToShow = dbServices.map((service, index) => ({
        name: service.title,
        slug: service.id, 
        description: service.description || "Servicio profesional.",
        imageUrl: STOCK_IMAGES[index % STOCK_IMAGES.length]
      }));
    }

  } catch (error) {
    console.error("⚠️ La Base de Datos falló, pero la web sigue viva:", error);
    // No hacemos nada más, categoriesToShow ya tiene el valor de respaldo
  }

  return (
    <div>
      <HeroSection />
      <MissionVideo />
      
      {/* Aquí pasamos los datos (sean de la BD o del Respaldo) */}
      <CategorySection categories={categoriesToShow} title="Nuestros Servicios" />
      
      <ProfessionalCtaSection />
    </div>
  );
}
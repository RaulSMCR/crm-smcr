// src/components/CategorySection.js
import { prisma } from '@/lib/prisma';
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import MissionVideo from "@/components/MissionVideo";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";

// Imágenes de stock para decorar los servicios (ya que la BD aun no tiene campo de imagen)
const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80', // Psicología
  'https://images.unsplash.com/photo-1543352634-8730b6e7a88a?w=1600&q=80', // Nutrición
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80', // Terapia
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80', // Coaching
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&q=80', // Médico
];

// Forzamos dinamismo para que si creas un servicio, aparezca al recargar
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // 1. Buscamos los servicios reales en la Base de Datos
  const dbServices = await prisma.service.findMany({
    take: 4, // Mostramos máximo 4 en la home
    orderBy: { createdAt: 'desc' }
  });

  // 2. Transformamos los datos al formato que CategorySection entiende
  // (Mapeamos 'title' a 'name' y asignamos una imagen aleatoria)
  const realCategories = dbServices.map((service, index) => ({
    name: service.title,
    // Usamos el ID como slug para que el link lleve a /servicios/[id]
    slug: service.id, 
    description: service.description || "Servicio profesional especializado.",
    imageUrl: STOCK_IMAGES[index % STOCK_IMAGES.length] // Ciclo de imágenes
  }));

  // Si no hay servicios en la BD, usamos undefined para que CategorySection use sus fallbacks
  const categoriesToShow = realCategories.length > 0 ? realCategories : undefined;

  return (
    <div>
      <HeroSection />
      <MissionVideo />
      
      {/* Pasamos los datos reales al componente */}
      <CategorySection categories={categoriesToShow} title="Nuestros Servicios" />
      
      <ProfessionalCtaSection />
    </div>
  );
}
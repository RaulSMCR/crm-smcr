// src/app/page.js
// import { prisma } from '@/lib/prisma'; <--- COMENTADO O BORRADO
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import MissionVideo from "@/components/MissionVideo";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";

// Datos de respaldo estáticos (Hardcodeados)
const STATIC_CATEGORIES = [
  {
    name: 'Psicología',
    slug: 'psicologia',
    description: 'Terapias y acompañamiento psicológico.',
    imageUrl: 'https://images.unsplash.com/photo-1526253038957-bce54e05968c?w=1600&q=80',
  },
  {
    name: 'Nutrición',
    slug: 'nutricion',
    description: 'Planes alimenticios y bienestar integral.',
    imageUrl: 'https://images.unsplash.com/photo-1543352634-8730b6e7a88a?w=1600&q=80',
  },
  {
    name: 'Terapia',
    slug: 'terapia',
    description: 'Sesiones individuales y familiares.',
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1600&q=80',
  },
  {
    name: 'Coaching',
    slug: 'coaching',
    description: 'Objetivos profesionales y personales.',
    imageUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1600&q=80',
  },
];

export const dynamic = 'force-dynamic';

export default function HomePage() {
  // YA NO LLAMAMOS A LA BD. Usamos los datos fijos.
  const categoriesToShow = STATIC_CATEGORIES;

  return (
    <div>
      <HeroSection />
      <MissionVideo />
      <CategorySection categories={categoriesToShow} title="Nuestros Servicios" />
      <ProfessionalCtaSection />
    </div>
  );
}
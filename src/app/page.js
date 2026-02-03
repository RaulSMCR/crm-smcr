// src/app/page.js
// src/app/page.js
export const dynamic = 'force-dynamic'; // <--- ESTO ES VITAL
export const revalidate = 0;

// ... resto del código ...
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import MissionVideo from "@/components/MissionVideo";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <MissionVideo /> {/* <-- Movido aquí arriba */}
      <CategorySection />
      <ProfessionalCtaSection />
    </div>
  );
}
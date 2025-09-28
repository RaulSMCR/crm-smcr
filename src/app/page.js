// src/app/page.js
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
// src/app/page.js
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";
import ColorPaletteGuide from "@/components/ColorPaletteGuide"; // <-- 1. Importar

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <CategorySection />
      <ProfessionalCtaSection />
      <ColorPaletteGuide /> {/* <-- 2. Añadir */}
    </div>
  );
}
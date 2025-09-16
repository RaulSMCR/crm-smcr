// src/app/page.js
import HeroSection from "@/components/HeroSection";
import CategorySection from "@/components/CategorySection";
import ProfessionalCtaSection from "@/components/ProfessionalCtaSection";

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <CategorySection />
      <ProfessionalCtaSection />
    </div>
  );
}
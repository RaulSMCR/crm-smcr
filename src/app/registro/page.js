"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const EASE = [0.4, 0, 0.2, 1];

const PANELS = {
  patient: {
    image: "/images/registro-paciente.webp",
    fallbackImage: "/images/paciente-hero.webp",
    href: "/registro/usuario",
    headline: "Quiero encontrar un profesional",
    subline: "Creo mi cuenta como paciente",
    narrative: "Tu bienestar comienza con un paso",
    cta: "Crear cuenta",
    fallbackBg: "#0c2223",
  },
  professional: {
    image: "/images/registro-profesional.webp",
    fallbackImage: "/images/profesional-hero.webp",
    href: "/registro/profesional",
    headline: "Soy profesional de la salud",
    subline: "Postulo mi perfil a la red",
    narrative: "Amplía tu alcance y tu impacto",
    cta: "Postularme",
    fallbackBg: "#1a1b1c",
  },
};

export default function RegistroPage() {
  const router = useRouter();
  const [hovered, setHovered] = useState(null);

  const getPanelFlex = (panelKey) => {
    if (hovered === panelKey) return { flex: "1.3 1 50%" };
    if (hovered !== null)     return { flex: "0.7 1 50%" };
    return { flex: "1 1 50%" };
  };

  return (
    <div
      className="flex w-full flex-col md:flex-row overflow-hidden"
      style={{ minHeight: "calc(100dvh - 4rem)" }}
    >
      {(["patient", "professional"]).map((panelKey) => {
        const config  = PANELS[panelKey];
        const isHov   = hovered === panelKey;
        const isDimmed = hovered !== null && !isHov;

        return (
          <motion.div
            key={panelKey}
            layout
            transition={{ layout: { duration: 0.55, ease: EASE } }}
            className="relative min-h-[45vh] cursor-pointer overflow-hidden md:min-h-0"
            style={{ ...getPanelFlex(panelKey), backgroundColor: config.fallbackBg }}
            onHoverStart={() => setHovered(panelKey)}
            onHoverEnd={() => setHovered(null)}
            onClick={() => router.push(config.href)}
          >
            {/* Hero image */}
            <motion.div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url('${config.image}'), url('${config.fallbackImage}')`,
              }}
              animate={{ scale: isHov ? 1.06 : 1 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            />

            {/* Overlay */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/35 to-neutral-950/10"
              animate={{ opacity: isDimmed ? 0.85 : 1 }}
              transition={{ duration: 0.3 }}
            />

            {/* Contenido */}
            <motion.div
              animate={{ opacity: isDimmed ? 0.5 : 1 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col items-center justify-end pb-14 px-10 text-center"
            >
              {/* Narrativa en hover */}
              <AnimatePresence>
                {isHov && (
                  <motion.p
                    key="narrative"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.28, ease: EASE }}
                    className={`${playfair.className} mb-3 max-w-[22ch] text-base italic leading-snug text-neutral-200 md:text-lg`}
                  >
                    {config.narrative}
                  </motion.p>
                )}
              </AnimatePresence>

              <motion.h2
                animate={{ scale: isHov ? 1.04 : 1 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={`${playfair.className} text-2xl font-bold text-white md:text-3xl`}
              >
                {config.headline}
              </motion.h2>

              <p className="mt-2 max-w-[20ch] text-sm text-neutral-300">
                {config.subline}
              </p>

              <motion.div
                animate={{
                  backgroundColor: isHov ? "rgba(43,112,115,0.75)" : "rgba(255,255,255,0.1)",
                  borderColor:     isHov ? "rgba(84,160,163,0.7)"  : "rgba(255,255,255,0.3)",
                }}
                transition={{ duration: 0.3 }}
                className="mt-7 rounded-full border px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm"
              >
                {config.cta}
              </motion.div>

              {panelKey === "patient" && (
                <div className="absolute right-0 top-1/2 hidden h-16 w-px -translate-y-1/2 bg-white/20 md:block" />
              )}
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

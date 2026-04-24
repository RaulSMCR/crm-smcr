"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/actions/auth-actions";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

function safeNextPath(nextValue) {
  const next = String(nextValue || "");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

const PANELS = {
  patient: {
    image: "/images/paciente-hero.webp",
    headline: "Soy paciente",
    subline: "Accedo a mi espacio de bienestar",
    narrativeNew: "Aquí comienza tu viaje",
    narrativeReturn: "Continuás tu recorrido",
    cta: "Ingresar",
    registerHref: "/registro/usuario",
    registerLabel: "Crear cuenta de paciente",
  },
  professional: {
    image: "/images/profesional-hero.webp",
    headline: "Soy profesional",
    subline: "Accedo al panel de mi práctica",
    narrativeNew: "Elegiste bien tu camino",
    narrativeReturn: "Siempre es bueno ver a los compañeros de vuelta",
    cta: "Ingresar",
    registerHref: "/registro/profesional",
    registerLabel: "Postularme como profesional",
  },
};

// ─── Easing personalizado ─────────────────────────────────────────────────────
const EASE = [0.4, 0, 0.2, 1];

// ─── Variantes compartidas ────────────────────────────────────────────────────
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: 8 },
};

// ─── Sub-componente: formulario dentro del panel ──────────────────────────────
function PanelForm({ panelKey, onBack, registered }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const isProfessionalRegistered = registered === "professional";
  const isGenericRegistered      = registered === "true" || registered === "user";
  const config = PANELS[panelKey];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const formData = new FormData(e.target);
    const res = await login(formData);
    if (res?.error) { setError(res.error); setLoading(false); return; }
    if (res?.success) {
      const next = safeNextPath(searchParams.get("next"));
      if (next) { router.push(next); return; }
      if (res.role === "ADMIN")         router.push("/panel/admin");
      else if (res.role === "PROFESSIONAL") router.push("/panel/profesional");
      else                              router.push("/panel/paciente");
      return;
    }
    setError("No se logró iniciar sesión. Por favor, intente nuevamente.");
    setLoading(false);
  };

  return (
    <motion.div
      className="w-full max-w-sm"
      {...fadeUp}
      transition={{ duration: 0.45, delay: 0.2, ease: EASE }}
    >
      {/* Volver */}
      <motion.button
        onClick={onBack}
        whileHover={{ x: -3 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="mb-7 flex items-center gap-2 text-sm text-neutral-300 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Volver
      </motion.button>

      {/* Titular */}
      <h2 className={`${playfair.className} text-3xl font-bold text-white mb-1`}>
        {config.headline}
      </h2>
      <p className="text-sm text-neutral-300 mb-7">{config.subline}</p>

      {/* Avisos */}
      <AnimatePresence>
        {isProfessionalRegistered && (
          <motion.div {...fadeUp} transition={{ duration: 0.3 }}
            className="mb-5 rounded-xl border border-brand-400/30 bg-brand-950/60 p-4 text-sm text-brand-100 backdrop-blur-sm"
          >
            <p className="font-bold mb-1">Postulación enviada con éxito</p>
            <ol className="list-decimal list-inside space-y-0.5 text-brand-200">
              <li>Verifique su correo (incluida la carpeta de spam).</li>
              <li>El coordinador agendará una entrevista por WhatsApp.</li>
            </ol>
          </motion.div>
        )}
        {!isProfessionalRegistered && isGenericRegistered && (
          <motion.div {...fadeUp} transition={{ duration: 0.3 }}
            className="mb-5 rounded-xl border border-brand-400/30 bg-brand-950/60 p-4 text-sm text-brand-100 backdrop-blur-sm"
          >
            Cuenta creada con éxito. Revise su correo para verificarla.
          </motion.div>
        )}
        {error && (
          <motion.div key="error" {...fadeUp} transition={{ duration: 0.25 }}
            className="mb-5 rounded-xl border border-accent-400/30 bg-accent-950/60 p-4 text-sm text-accent-100 backdrop-blur-sm"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-neutral-300">
            Correo electrónico
          </label>
          <input
            name="email" type="email" required autoComplete="email"
            placeholder="correo@dominio.com"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-neutral-500 backdrop-blur-sm outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-300 transition-all"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-neutral-300">
            Contraseña
          </label>
          <div className="relative">
            <input
              name="password" type={showPwd ? "text" : "password"} required autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 pr-12 text-white placeholder-neutral-500 backdrop-blur-sm outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-300 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors"
              tabIndex={-1}
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPwd ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          <div className="mt-2 text-right">
            <Link href="/recuperar" className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200 transition-colors">
              ¿Olvidó su contraseña?
            </Link>
          </div>
        </div>

        <motion.button
          type="submit" disabled={loading}
          whileHover={!loading ? { scale: 1.02 } : {}}
          whileTap={!loading ? { scale: 0.98 } : {}}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="mt-1 w-full rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {loading ? "Validando…" : config.cta}
        </motion.button>
      </form>

      <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-neutral-400">
        ¿Sin cuenta?{" "}
        <Link href={config.registerHref} className="font-medium text-brand-300 hover:text-brand-200 transition-colors">
          {config.registerLabel}
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function LoginClient() {
  const searchParams = useSearchParams();
  const [phase, setPhase]           = useState("choose"); // 'choose' | 'form'
  const [activeSide, setActiveSide] = useState(null);
  const [hovered, setHovered]       = useState(null);

  const registered  = searchParams.get("registered");
  const isReturn    = !!registered;

  const handleSelect = (side) => { setActiveSide(side); setPhase("form"); };
  const handleBack   = () => { setPhase("choose"); setActiveSide(null); setHovered(null); };

  // Flex CSS por panel según fase/hover
  const getPanelFlex = (panelKey) => {
    if (phase === "form") {
      return panelKey === activeSide
        ? { flex: "1 1 100%" }
        : { flex: "0 0 0%", minWidth: 0, overflow: "hidden" };
    }
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
        const config   = PANELS[panelKey];
        const isActive = activeSide === panelKey;
        const isHov    = hovered === panelKey;
        const isDimmed = phase === "choose" && hovered !== null && !isHov;

        return (
          <motion.div
            key={panelKey}
            layout
            transition={{ layout: { duration: 0.55, ease: EASE } }}
            className={[
              "relative overflow-hidden bg-surface-dark",
              phase === "choose" ? "cursor-pointer" : "",
              "min-h-[45vh] md:min-h-0",
            ].join(" ")}
            style={{ ...getPanelFlex(panelKey) }}
            onHoverStart={() => phase === "choose" && setHovered(panelKey)}
            onHoverEnd={() => phase === "choose" && setHovered(null)}
            onClick={() => phase === "choose" && handleSelect(panelKey)}
          >
            {/* Hero image con zoom sutil */}
            <motion.div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url('${config.image}')` }}
              animate={{ scale: isHov ? 1.06 : 1 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            />

            {/* Overlay gradiente sepia/oscuro */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/35 to-neutral-950/10"
              animate={{ opacity: isDimmed ? 0.85 : 1 }}
              transition={{ duration: 0.3 }}
            />

            {/* ── Contenido fase elegir ── */}
            <AnimatePresence>
              {phase === "choose" && (
                <motion.div
                  key="choose"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isDimmed ? 0.5 : 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  className="absolute inset-0 flex flex-col items-center justify-end pb-14 px-10 text-center"
                >
                  {/* Narrativa — aparece solo en hover */}
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
                        {isReturn ? config.narrativeReturn : config.narrativeNew}
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

                  <p className="mt-2 max-w-[18ch] text-sm text-neutral-300">
                    {config.subline}
                  </p>

                  {/* Pill CTA */}
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

                  {/* Separador visual entre paneles (solo desktop) */}
                  {panelKey === "patient" && (
                    <div className="absolute right-0 top-1/2 hidden h-16 w-px -translate-y-1/2 bg-white/20 md:block" />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Contenido fase formulario ── */}
            <AnimatePresence>
              {phase === "form" && isActive && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  className="absolute inset-0 flex items-center justify-center px-6 py-10 md:px-12"
                >
                  <PanelForm panelKey={panelKey} onBack={handleBack} registered={registered} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}

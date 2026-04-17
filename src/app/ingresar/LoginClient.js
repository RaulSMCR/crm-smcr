"use client";

import { useState } from "react";
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
    image: "/images/paciente-hero.jpg",
    headline: "Soy paciente",
    subline: "Accedo a mi espacio de bienestar",
    narrativeNew: "Aquí comienza tu viaje",
    narrativeReturn: "Continuás tu recorrido",
    cta: "Ingresar",
    registerHref: "/registro/usuario",
    registerLabel: "Crear cuenta de paciente",
    overlayClass: "from-neutral-950/80 via-neutral-950/30 to-neutral-950/10",
    fallbackBg: "bg-brand-950",
  },
  professional: {
    image: "/images/profesional-hero.jpg",
    headline: "Soy profesional",
    subline: "Accedo al panel de mi práctica",
    narrativeNew: "Elegiste bien tu camino",
    narrativeReturn: "Siempre es bueno ver a los compañeros de vuelta",
    cta: "Ingresar",
    registerHref: "/registro/profesional",
    registerLabel: "Postularme como profesional",
    overlayClass: "from-neutral-950/80 via-neutral-950/40 to-neutral-950/10",
    fallbackBg: "bg-neutral-900",
  },
};

// ─── Sub-component: Form inside the panel ────────────────────────────────────
function PanelForm({ panelKey, onBack, registered }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isProfessionalRegistered = registered === "professional";
  const isGenericRegistered = registered === "true" || registered === "user";
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
      if (res.role === "ADMIN") router.push("/panel/admin");
      else if (res.role === "PROFESSIONAL") router.push("/panel/profesional");
      else router.push("/panel/paciente");
      return;
    }
    setError("No se logró iniciar sesión. Por favor, intente nuevamente.");
    setLoading(false);
  };

  return (
    <div className="w-full max-w-sm animate-fadein">
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-7 flex items-center gap-2 text-sm text-neutral-300 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
          <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
        </svg>
        Volver
      </button>

      {/* Headline */}
      <h2 className={`${playfair.className} text-3xl font-bold text-white mb-1`}>
        {config.headline}
      </h2>
      <p className="text-sm text-neutral-300 mb-7">{config.subline}</p>

      {/* Notices */}
      {isProfessionalRegistered && (
        <div className="mb-5 rounded-xl border border-brand-400/30 bg-brand-950/60 p-4 text-sm text-brand-100 backdrop-blur-sm">
          <p className="font-bold mb-1">Postulación enviada con éxito</p>
          <ol className="list-decimal list-inside space-y-0.5 text-brand-200">
            <li>Verifique su correo (incluida la carpeta de spam).</li>
            <li>El coordinador agendará una entrevista por WhatsApp.</li>
          </ol>
        </div>
      )}
      {!isProfessionalRegistered && isGenericRegistered && (
        <div className="mb-5 rounded-xl border border-brand-400/30 bg-brand-950/60 p-4 text-sm text-brand-100 backdrop-blur-sm">
          Cuenta creada con éxito. Revise su correo para verificarla y habilitar el acceso.
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-xl border border-accent-400/30 bg-accent-950/60 p-4 text-sm text-accent-100 backdrop-blur-sm">
          {error}
        </div>
      )}

      {/* Inputs */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-neutral-300">
            Correo electrónico
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="correo@dominio.com"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-neutral-500 backdrop-blur-sm outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-300 transition-all"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-neutral-300">
            Contraseña
          </label>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-neutral-500 backdrop-blur-sm outline-none focus:border-brand-300 focus:ring-1 focus:ring-brand-300 transition-all"
          />
          <div className="mt-2 text-right">
            <Link href="/recuperar" className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-200 transition-colors">
              ¿Olvidó su contraseña?
            </Link>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-full rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Validando…" : config.cta}
        </button>
      </form>

      <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-neutral-400">
        ¿Sin cuenta?{" "}
        <Link href={config.registerHref} className="font-medium text-brand-300 transition-colors hover:text-brand-200">
          {config.registerLabel}
        </Link>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LoginClient() {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState("choose"); // 'choose' | 'form'
  const [activeSide, setActiveSide] = useState(null); // 'patient' | 'professional'
  const [hovered, setHovered] = useState(null);

  const registered = searchParams.get("registered");
  const isReturn = !!registered;

  const handleSelect = (side) => {
    setActiveSide(side);
    setPhase("form");
  };

  const handleBack = () => {
    setPhase("choose");
    setActiveSide(null);
    setHovered(null);
  };

  // Inline styles for smooth flex-basis transitions on desktop
  const getPanelStyle = (panelKey) => {
    if (phase === "form") {
      return {
        flexBasis: panelKey === activeSide ? "100%" : "0%",
        flexGrow: panelKey === activeSide ? 1 : 0,
        flexShrink: panelKey === activeSide ? 0 : 1,
      };
    }
    // choose phase: hover expands
    if (hovered === panelKey) return { flexGrow: 1.3, flexBasis: "50%", flexShrink: 0.7 };
    if (hovered !== null)      return { flexGrow: 0.7, flexBasis: "50%", flexShrink: 1.3 };
    return { flexGrow: 1, flexBasis: "50%", flexShrink: 1 };
  };

  // Mobile heights
  const getMobileHeightClass = (panelKey) => {
    if (phase === "form") {
      return panelKey === activeSide ? "h-screen md:h-auto" : "h-0 md:h-auto";
    }
    return "min-h-[50vh] md:min-h-0";
  };

  return (
    <>
      {/* Global animation keyframes */}
      <style>{`
        @keyframes fadein {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadein { animation: fadein 0.45s ease-out both; }
      `}</style>

      <div
        className="flex w-full flex-col md:flex-row overflow-hidden"
        style={{ minHeight: "calc(100dvh - 4rem)" }}
      >
        {(["patient", "professional"]).map((panelKey) => {
          const config = PANELS[panelKey];
          const isHovered = hovered === panelKey;
          const isActive = activeSide === panelKey;
          const isDimmed = hovered !== null && hovered !== panelKey && phase === "choose";
          const isHidden = phase === "form" && activeSide !== panelKey;

          return (
            <div
              key={panelKey}
              className={[
                "relative overflow-hidden",
                "transition-all duration-500 ease-in-out",
                getMobileHeightClass(panelKey),
                config.fallbackBg,
                phase === "choose" ? "cursor-pointer" : "",
              ].join(" ")}
              style={getPanelStyle(panelKey)}
              onMouseEnter={() => phase === "choose" && setHovered(panelKey)}
              onMouseLeave={() => phase === "choose" && setHovered(null)}
              onClick={() => phase === "choose" && handleSelect(panelKey)}
              aria-hidden={isHidden}
            >
              {/* Hero image */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-in-out"
                style={{
                  backgroundImage: `url('${config.image}')`,
                  transform: isHovered ? "scale(1.04)" : "scale(1)",
                }}
              />

              {/* Sepia/dark overlay */}
              <div
                className={[
                  "absolute inset-0 bg-gradient-to-t transition-opacity duration-500",
                  config.overlayClass,
                  isDimmed ? "opacity-90" : "opacity-100",
                ].join(" ")}
              />

              {/* ── CHOOSE PHASE content ── */}
              {phase === "choose" && (
                <div
                  className={[
                    "absolute inset-0 flex flex-col items-center justify-end pb-14 px-10 text-center",
                    "transition-opacity duration-400",
                    isDimmed ? "opacity-50" : "opacity-100",
                  ].join(" ")}
                >
                  {/* Narrative — fades in on hover */}
                  <p
                    className={[
                      playfair.className,
                      "italic text-neutral-200 text-base md:text-lg mb-3 leading-snug max-w-xs",
                      "transition-all duration-400",
                      isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
                    ].join(" ")}
                  >
                    {isReturn ? config.narrativeReturn : config.narrativeNew}
                  </p>

                  <h2
                    className={[
                      playfair.className,
                      "text-white font-bold text-2xl md:text-3xl tracking-wide transition-all duration-300",
                      isHovered ? "scale-105" : "scale-100",
                    ].join(" ")}
                  >
                    {config.headline}
                  </h2>

                  <p className="mt-2 text-sm text-neutral-300 max-w-[18ch]">
                    {config.subline}
                  </p>

                  {/* Pill CTA */}
                  <div
                    className={[
                      "mt-7 px-6 py-2.5 rounded-full text-sm font-semibold text-white",
                      "border border-white/30 backdrop-blur-sm",
                      "transition-all duration-300",
                      isHovered
                        ? "bg-brand-600 border-brand-400"
                        : "bg-white/10",
                    ].join(" ")}
                  >
                    {config.cta}
                  </div>

                  {/* Divider hint on desktop */}
                  {panelKey === "patient" && (
                    <div className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-16 w-px bg-white/20" />
                  )}
                </div>
              )}

              {/* ── FORM PHASE content ── */}
              {phase === "form" && isActive && (
                <div className="absolute inset-0 flex items-center justify-center px-6 py-10 md:px-12">
                  <PanelForm panelKey={panelKey} onBack={handleBack} registered={registered} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

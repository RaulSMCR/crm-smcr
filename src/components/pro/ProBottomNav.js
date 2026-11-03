"use client";

// Navegación inferior fija de la PWA de profesionales (/pro/*). Mismo estilo que
// la de pacientes (MiBottomNav). Las pestañas se suman a medida que se construye
// cada etapa; mientras tanto, lo que falta se hace desde el panel completo.
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/pro", label: "Hoy", icon: "sun", exact: true },
  { href: "/pro/semana", label: "Semana", icon: "calendar" },
  { href: "/panel/profesional/citas", label: "Panel completo", icon: "panel", externa: true },
];

function TabIcon({ name }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: "h-6 w-6",
    "aria-hidden": true,
  };

  switch (name) {
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "panel":
      return (
        <svg {...common}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
      );
    default:
      return null;
  }
}

export default function ProBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const className = `flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
            active ? "text-brand-600" : "text-neutral-500 hover:text-neutral-700"
          }`;

          return (
            <li key={tab.href} className="flex-1">
              {/* El panel queda fuera del scope de la app: se abre con un <a>
                  común para que el navegador salga del modo app sin problema. */}
              {tab.externa ? (
                <a href={tab.href} className={className}>
                  <TabIcon name={tab.icon} />
                  <span>{tab.label}</span>
                </a>
              ) : (
                <Link href={tab.href} aria-current={active ? "page" : undefined} className={className}>
                  <TabIcon name={tab.icon} />
                  <span>{tab.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

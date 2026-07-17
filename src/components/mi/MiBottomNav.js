"use client";

// Navegación inferior fija de la PWA de pacientes (/mi/*).
// Íconos SVG inline al estilo lucide (stroke 2, 24px) — el proyecto no usa
// librería de íconos y toda la UI usa SVG inline. Tab activo en brand-600.
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/mi", label: "Inicio", icon: "home", exact: true },
  { href: "/mi/agenda", label: "Agenda", icon: "calendar" },
  { href: "/mi/pagos", label: "Pagos", icon: "card" },
  { href: "/mi/biblioteca", label: "Biblioteca", icon: "book" },
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
    case "home":
      return (
        <svg {...common}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
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
    case "card":
      return (
        <svg {...common}>
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3-3h7z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function MiBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex w-full max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
                  active ? "text-brand-600" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                <TabIcon name={tab.icon} />
                <span>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

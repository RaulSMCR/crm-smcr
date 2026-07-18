// src/components/mi/ui.js
// Piezas presentacionales y formateadores compartidos por las tabs de /mi.
// Módulo puro (sin hooks ni APIs de navegador): lo consumen client components.
// Paleta: brand (teal) / accent (coral) / neutral — los semánticos success/
// warning/danger no están definidos en CSS (ver globals.css).
import { DEFAULT_TZ } from "@/lib/timezone";
import { normalizeImageSrc } from "@/lib/images";

// ── Formateadores ────────────────────────────────────────────────────────────
export function formatDateTime(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: DEFAULT_TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: DEFAULT_TZ,
    dateStyle: "medium",
  }).format(new Date(iso));
}

// Fecha relativa natural ("ayer", "hace 3 días", "hace 2 meses"). Sirve para
// pasado y futuro; Intl.RelativeTimeFormat maneja el signo del diferencial.
export function formatRelative(date) {
  if (!date) return "";
  const diffMs = new Date(date).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const H = 3600000;
  const D = 86400000;

  if (abs < H) return rtf.format(Math.round(diffMs / 60000), "minute");
  if (abs < D) return rtf.format(Math.round(diffMs / H), "hour");
  if (abs < 30 * D) return rtf.format(Math.round(diffMs / D), "day");
  if (abs < 365 * D) return rtf.format(Math.round(diffMs / (30 * D)), "month");
  return rtf.format(Math.round(diffMs / (365 * D)), "year");
}

export function formatMoney(amount, currency = "CRC") {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("es-CR")}`;
  }
}

// ── Diccionarios de estado ───────────────────────────────────────────────────
export const APPOINTMENT_STATUS = {
  PENDING: { label: "Pendiente", tone: "coral" },
  CONFIRMED: { label: "Confirmada", tone: "teal" },
  CANCELLED_BY_USER: { label: "Cancelada", tone: "neutral" },
  CANCELLED_BY_PRO: { label: "Cancelada (prof.)", tone: "neutral" },
  COMPLETED: { label: "Completada", tone: "teal" },
  NO_SHOW: { label: "No asistida", tone: "neutral" },
};

export const PAYMENT_STATUS = {
  APPROVED: { label: "Pagado", tone: "teal" },
  PENDING: { label: "Pendiente", tone: "coral" },
  LINK_SENT: { label: "Pendiente", tone: "coral" },
  REJECTED: { label: "Rechazado", tone: "coral" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
  EXPIRED: { label: "Expirado", tone: "neutral" },
};

export const PAYMENT_TYPE = {
  DEPOSIT_50: "Adelanto 50%",
  BALANCE_50: "Saldo 50%",
  FULL_100: "Pago completo",
};

// ── Componentes ──────────────────────────────────────────────────────────────
const PILL_TONE = {
  teal: "bg-brand-100 text-brand-800",
  coral: "bg-accent-100 text-accent-800",
  neutral: "bg-neutral-200 text-neutral-700",
};

export function Pill({ tone = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        PILL_TONE[tone] || PILL_TONE.neutral
      }`}
    >
      {children}
    </span>
  );
}

export function SectionHeader({ title, subtitle, right }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
      </div>
      {right ?? null}
    </header>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Avatar({ src, name }) {
  const initials = (name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const safeSrc = normalizeImageSrc(src);
  if (safeSrc) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={safeSrc} alt={name || ""} className="h-11 w-11 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
      {initials}
    </div>
  );
}

export function SkeletonCards({ count = 3 }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index}>
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-neutral-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-2/3 rounded bg-neutral-200" />
                <div className="h-3 w-1/3 rounded bg-neutral-200" />
              </div>
            </div>
            <div className="h-3 w-full rounded bg-neutral-200" />
            <div className="h-3 w-4/5 rounded bg-neutral-200" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export function AppointmentCard({ cita, highlight = false }) {
  const status = APPOINTMENT_STATUS[cita.status] || { label: cita.status, tone: "neutral" };
  return (
    <Card className={highlight ? "border-brand-200 ring-1 ring-brand-100" : ""}>
      <div className="flex items-start gap-3">
        <Avatar src={cita.profesional?.image} name={cita.profesional?.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-semibold text-neutral-900">
              {cita.profesional?.name || "Profesional"}
            </p>
            <Pill tone={status.tone}>{status.label}</Pill>
          </div>
          {cita.profesional?.specialty ? (
            <p className="text-xs text-neutral-500">{cita.profesional.specialty}</p>
          ) : null}
          {cita.servicio ? (
            <p className="mt-1 text-sm text-neutral-700">{cita.servicio}</p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-brand-700">{formatDateTime(cita.date)}</p>

          {cita.meetLink ? (
            <a
              href={cita.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
            >
              Unirse a la videollamada
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({ title, message }) {
  return (
    <Card className="text-center">
      <p className="font-semibold text-neutral-800">{title}</p>
      {message ? <p className="mt-1 text-sm text-neutral-500">{message}</p> : null}
    </Card>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Card className="text-center">
      <p className="text-sm text-neutral-700">{message || "Ocurrió un error."}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500"
        >
          Reintentar
        </button>
      ) : null}
    </Card>
  );
}

// Presentacional puro (sin hooks): usable desde server y client components.
const STATUS_STYLES = {
  DRAFT: { label: "Borrador", cls: "border-neutral-300 bg-neutral-100 text-neutral-700" },
  GENERATED: { label: "Generado", cls: "border-brand-300 bg-brand-100 text-brand-900" },
  APPROVED: { label: "Aprobado", cls: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  PUBLISHED: { label: "Publicado", cls: "border-accent-300 bg-accent-100 text-accent-950" },
};

export default function CarouselStatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.DRAFT;
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${s.cls}`}>
      {s.label}
    </span>
  );
}

export { STATUS_STYLES };

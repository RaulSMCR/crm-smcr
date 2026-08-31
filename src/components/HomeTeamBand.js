import Link from "next/link";
import { SafeAvatar } from "@/components/SafeImage";

/**
 * Banda del equipo, de ancho completo y debajo de la capa dividida.
 *
 * Queda fuera del split por dos razones. Una tercera columna dejaría cada
 * tarjeta en poco más de trescientos píxeles y una foto de persona a ese ancho
 * ya no es un retrato. La otra es de ritmo: la home venía de dos grillas, y una
 * tercera del mismo formato y sobre el mismo crema se lee como más de lo mismo.
 * Sobre el teal la banda se separa y cierra la sección.
 *
 * Las tarjetas están hechas para foto. Hoy ningún perfil tiene una cargada y se
 * ve la inicial: es un estado de espera declarado, no el diseño final. Las
 * fotos se suben desde el perfil de cada profesional.
 */

function inicialDe(nombre) {
  return String(nombre || "S").trim().charAt(0).toUpperCase() || "S";
}

function TeamCard({ professional }) {
  const nombre = professional.name || "Profesional";
  const href = professional.slug
    ? `/profesionales/${professional.slug}`
    : `/agendar/${professional.id}`;

  return (
    <Link
      href={href}
      className="group flex flex-col items-center rounded-2xl bg-neutral-50 p-6 text-center no-underline shadow-card transition-transform duration-300 hover:-translate-y-1 hover:no-underline"
    >
      <div className="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-brand-100 shadow-card">
        {professional.image ? (
          <SafeAvatar
            src={professional.image}
            name={nombre}
            alt={`Foto de ${nombre}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-brand-800">
            {inicialDe(nombre)}
          </div>
        )}
      </div>

      <h3 className="mt-4 text-base font-bold leading-snug text-neutral-950 group-hover:text-brand-800">
        {nombre}
      </h3>

      {professional.specialty ? (
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-900">
          {professional.specialty}
        </p>
      ) : null}

      {professional.licenseNumber ? (
        <p className="mt-2 text-xs text-neutral-600">
          Colegiatura {professional.licenseNumber}
        </p>
      ) : null}

      <span className="mt-4 text-xs font-semibold text-brand-800 group-hover:underline">
        Ver perfil →
      </span>
    </Link>
  );
}

export default function HomeTeamBand({ professionals = [] }) {
  if (!professionals.length) return null;

  return (
    <section className="nv-panel px-4 py-16">
      <div className="container mx-auto">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white">Nuestros profesionales</h2>
            <p className="mt-2 text-sm text-white/80">
              Cada perfil declara su colegiatura y los servicios que atiende.
            </p>
          </div>

          <Link
            href="/profesionales"
            className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-white no-underline hover:underline"
          >
            Ver todo el equipo
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
          {professionals.map((professional) => (
            <TeamCard key={professional.id} professional={professional} />
          ))}
        </div>
      </div>
    </section>
  );
}

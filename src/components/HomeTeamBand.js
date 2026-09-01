import Link from "next/link";
import { SafeAvatar } from "@/components/SafeImage";
import FichaProfesionalDialog from "@/components/FichaProfesionalDialog";

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

  // Tres destinos distintos en una tarjeta: la foto amplía la ficha, el nombre
  // va al perfil y el botón va a agendar. Por eso dejó de ser un solo enlace
  // envolvente —además, un ancla no puede anidarse dentro de otra.
  return (
    <article className="flex flex-col items-center rounded-2xl bg-neutral-50 p-6 text-center shadow-card transition-transform duration-300 hover:-translate-y-1">
      <FichaProfesionalDialog
        professional={professional}
        triggerClassName="relative h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-brand-100 shadow-card transition hover:ring-2 hover:ring-accent-500"
      >
        {professional.image ? (
          <SafeAvatar
            src={professional.image}
            name={nombre}
            alt={`Foto de ${nombre}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-4xl font-bold text-brand-800">
            {inicialDe(nombre)}
          </span>
        )}
      </FichaProfesionalDialog>

      <Link href={href} className="no-underline hover:no-underline">
        <h3 className="mt-4 text-base font-bold leading-snug text-neutral-950 hover:text-brand-800 hover:underline">
          {nombre}
        </h3>
      </Link>

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

      {/* Coral y no teal: es la única acción de conversión de la banda, y el
          coral es el acento reservado para eso. El "Ver perfil" queda como
          enlace discreto para no competir con ella. */}
      <Link
        href={`/agendar/${professional.id}`}
        aria-label={`Agendar cita con ${nombre}`}
        className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-accent-700 px-4 py-2 text-sm font-semibold text-white no-underline transition hover:bg-accent-800 hover:no-underline"
      >
        Agendar cita
      </Link>

      <Link
        href={href}
        className="mt-2 text-xs font-semibold text-brand-800 no-underline hover:underline"
      >
        Ver perfil →
      </Link>
    </article>
  );
}

export default function HomeTeamBand({ professionals = [] }) {
  if (!professionals.length) return null;

  return (
    <section className="nv-panel px-4 py-16">
      <div className="container mx-auto">
        <div className="mb-8">
          {/* El destino es /profesionales y no /nosotros: esa URL vieja es un
              301 permanente hacia acá desde S9, así que enlazarla sería
              mandar a todo el mundo por un salto de más. */}
          <h2 className="text-3xl font-bold text-white">
            <Link href="/profesionales" className="text-white no-underline hover:underline">
              Nuestros profesionales
            </Link>
          </h2>
          <p className="mt-2 text-sm text-white/80">
            Cada perfil declara su colegiatura y los servicios que atiende.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
          {professionals.map((professional) => (
            <TeamCard key={professional.id} professional={professional} />
          ))}
        </div>

        <Link
          href="/profesionales"
          aria-label="Más profesionales"
          className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-white no-underline hover:underline"
        >
          Más
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

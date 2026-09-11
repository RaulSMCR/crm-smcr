"use client";

import Link from "next/link";
import { SafeAvatar } from "@/components/SafeImage";
import FichaProfesionalDialog from "@/components/FichaProfesionalDialog";
import WhiplashCorner from "@/components/ornaments/WhiplashCorner";

export default function ProfessionalProfileCard({ professional }) {
  const publicHref = professional.slug ? `/profesionales/${professional.slug}` : `/agendar/${professional.id}`;
  const review = professional.profileReview;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-nv-teal-deep/15 bg-neutral-50 shadow-card transition duration-300 hover:-translate-y-1 hover:border-nv-coral/50">
      {/* Cabecera en la superficie Nouveau, la misma del perfil individual y del
          carrusel de la home. Antes era `from-blue-50 to-indigo-50`, que los
          alias de Tailwind resuelven a brand-50: un menta frío que no es de la
          paleta y que, con el `bg-white` de la ficha reescrito a crema, dejaba
          todo lavado sobre el crema de la página. */}
      <div className="nv-panel relative h-36">
        <div className="pointer-events-none absolute -right-10 -top-10 z-0 aspect-square w-44 text-nv-cream opacity-25">
          <WhiplashCorner className="h-full w-full" />
        </div>

        {/* La foto amplía la ficha en vez de navegar al perfil. Ir al perfil
            sigue estando a un clic, en el botón "Ver perfil" de más abajo.
            El aro toma el color del cuerpo para que la foto parezca calada en
            la ficha, y el foco se marca con contorno coral: el teal por defecto
            desaparece sobre la mitad que cae en la cabecera. */}
        <FichaProfesionalDialog
          professional={{
            id: professional.id,
            slug: professional.slug,
            name: professional.user.name,
            image: professional.user.image,
            specialty: professional.specialty,
            licenseNumber: professional.licenseNumber,
          }}
          triggerClassName="absolute -bottom-14 left-1/2 flex h-28 w-28 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-neutral-50 bg-nv-teal shadow-card transition hover:ring-2 hover:ring-nv-coral focus-visible:outline-nv-coral"
        >
          {professional.user.image ? (
            <SafeAvatar
              src={professional.user.image}
              name={professional.user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-display text-5xl font-light text-nv-cream-hi">
              {professional.user.name.charAt(0)}
            </span>
          )}
        </FichaProfesionalDialog>
      </div>

      <div className="flex flex-grow flex-col px-6 pb-6 pt-[4.5rem] text-center">
        <Link
          href={publicHref}
          className="font-display text-[1.7rem] font-semibold leading-tight text-nv-teal-deep hover:text-nv-teal"
        >
          {professional.user.name}
        </Link>

        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-900">
          {professional.specialty || "Profesional de Salud"}
        </p>

        <span aria-hidden="true" className="mx-auto my-4 block h-0.5 w-10 bg-nv-coral" />

        {professional.licenseNumber && (
          <p className="mb-3 text-xs text-neutral-600">
            <span className="font-semibold text-neutral-800">Matrícula profesional:</span>{" "}
            {professional.licenseNumber}
          </p>
        )}

        {review && (
          <p className="mb-4 line-clamp-3 text-sm leading-6 text-neutral-700">{review}</p>
        )}

        <div className="mt-auto">
          <div className="mb-5 flex flex-wrap justify-center gap-2">
            {professional.serviceAssignments.length > 0 ? (
              professional.serviceAssignments.map((assignment) => (
                <span
                  key={assignment.service.id}
                  className="rounded-full border border-nv-teal-pale/70 bg-nv-teal-pale/20 px-2.5 py-1 text-xs font-medium text-nv-teal-deep"
                >
                  {assignment.service.title}
                </span>
              ))
            ) : (
              <span className="text-xs italic text-neutral-500">Consultas generales</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Link
              href={publicHref}
              className="btn btn-accent w-full"
            >
              Ver perfil
            </Link>
            <Link
              href={`/agendar/${professional.id}`}
              className="btn btn-outline w-full"
            >
              Agendar cita
            </Link>
            <Link
              href={`/blog?autor=${professional.slug}`}
              className="btn btn-outline w-full"
            >
              Ver artículos publicados
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

"use client";

import Link from "next/link";

export default function ProfessionalProfileCard({ professional }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="relative h-32 bg-gradient-to-r from-blue-50 to-indigo-50">
        <Link
          href={`/agendar/${professional.id}`}
          className="absolute -bottom-12 left-1/2 flex h-24 w-24 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`Ver perfil de ${professional.user.name}`}
        >
          {professional.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={professional.user.image}
              alt={professional.user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-3xl font-bold text-blue-600">
              {professional.user.name.charAt(0)}
            </span>
          )}
        </Link>
      </div>

      <div className="flex flex-grow flex-col px-6 pb-6 pt-14 text-center">
        <Link
          href={`/agendar/${professional.id}`}
          className="mb-1 text-xl font-bold text-gray-900 hover:text-blue-700"
        >
          {professional.user.name}
        </Link>

        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-blue-600">
          {professional.specialty || "Profesional de Salud"}
        </p>

        {professional.licenseNumber && (
          <p className="mb-3 text-xs text-gray-600">
            <span className="font-semibold">Matrícula profesional:</span>{" "}
            {professional.licenseNumber}
          </p>
        )}

        {professional.bio && (
          <p className="mb-4 line-clamp-3 text-sm text-gray-500">{professional.bio}</p>
        )}

        <div className="mt-auto">
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {professional.serviceAssignments.length > 0 ? (
              professional.serviceAssignments.map((assignment) => (
                <span
                  key={assignment.service.id}
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                >
                  {assignment.service.title}
                </span>
              ))
            ) : (
              <span className="text-xs italic text-gray-400">Consultas generales</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Link
              href={`/agendar/${professional.id}`}
              className="inline-block w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              Agendar cita
            </Link>
            <Link
              href={`/blog?autor=${professional.slug}`}
              className="inline-block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Ver artículos publicados
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

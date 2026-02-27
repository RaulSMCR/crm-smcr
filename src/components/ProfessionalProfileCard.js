'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfessionalProfileCard({ professional }) {
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);

  return (
    <>
      <article className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col">
        <div className="h-32 bg-gradient-to-r from-blue-50 to-indigo-50 relative">
          <button
            type="button"
            onClick={() => setIsPhotoOpen(true)}
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-white flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Ver foto ampliada de ${professional.user.name}`}
          >
            {professional.user.image ? (
              <Image
                src={professional.user.image}
                alt={professional.user.name}
                width={96}
                height={96}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-blue-600">{professional.user.name.charAt(0)}</span>
            )}
          </button>
        </div>

        <div className="pt-14 pb-6 px-6 text-center flex-grow flex flex-col">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{professional.user.name}</h2>

          <p className="text-blue-600 font-medium mb-2 text-sm uppercase tracking-wide">
            {professional.specialty || 'Profesional de Salud'}
          </p>

          {professional.licenseNumber && (
            <p className="text-xs text-gray-600 mb-3">
              <span className="font-semibold">Matrícula profesional:</span> {professional.licenseNumber}
            </p>
          )}

          {professional.bio && <p className="text-gray-500 text-sm mb-4 line-clamp-3">{professional.bio}</p>}

          <div className="mt-auto">
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {professional.serviceAssignments.length > 0 ? (
                professional.serviceAssignments.map((assignment) => (
                  <span key={assignment.service.id} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    {assignment.service.title}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">Consultas generales</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <Link
                href={`/agendar/${professional.id}`}
                className="inline-block w-full py-2 px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Agendar cita
              </Link>
              <Link
                href={`/blog?autor=${professional.slug}`}
                className="inline-block w-full py-2 px-4 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Ver artículos publicados
              </Link>
            </div>
          </div>
        </div>
      </article>

      {isPhotoOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada de ${professional.user.name}`}
          onClick={() => setIsPhotoOpen(false)}
        >
          <div className="relative max-w-xl w-full" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="absolute -top-10 right-0 text-white text-sm bg-black/40 px-3 py-1 rounded-md"
              onClick={() => setIsPhotoOpen(false)}
            >
              Cerrar
            </button>
            {professional.user.image ? (
              <Image
                src={professional.user.image}
                alt={professional.user.name}
                width={900}
                height={900}
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg bg-white"
              />
            ) : (
              <div className="w-full aspect-square rounded-lg bg-white flex items-center justify-center text-8xl font-bold text-blue-600">
                {professional.user.name.charAt(0)}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

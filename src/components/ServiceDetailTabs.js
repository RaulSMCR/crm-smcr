// src/components/ServiceDetailTabs.js
'use client'; // Necesario para usar estado (useState)

import { useState } from 'react';

// Recibimos la información del servicio como un 'prop'
export default function ServiceDetailTabs({ service }) {
  // 1. Creamos un estado para saber qué pestaña está activa.
  //    Por defecto, 'descripcion' será la activa.
  const [activeTab, setActiveTab] = useState('descripcion');

  return (
    <div>
      {/* 2. Contenedor de los botones de las pestañas */}
      <div className="border-b border-neutral-250">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('descripcion')}
            className={`${
              activeTab === 'descripcion'
                ? 'border-brand-primary text-brand-300'
                : 'border-transparent text-brand-300 hover:text-accent-300 hover:border-brand-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Descripción
          </button>

          <button
            onClick={() => setActiveTab('ficha')}
            className={`${
              activeTab === 'ficha'
                ? 'border-brand-primary text-neutral-250'
                : 'border-transparent text-brand-300 hover:text-accent-300 hover:border-brand-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Ficha Profesional
          </button>

          <button
            onClick={() => setActiveTab('valoraciones')}
            className={`${
              activeTab === 'valoraciones'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-brand-600 hover:text-accent-300 hover:border-brand-600'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Valoraciones
          </button>
        </nav>
      </div>

      {/* 3. Contenido que cambia según la pestaña activa */}
      <div className="mt-6">
        {activeTab === 'descripcion' && (
          <div>
            <p className="text-brand-300">{service.description}</p>
          </div>
        )}
        {activeTab === 'ficha' && (
          <div>
            <h3 className="font-bold text-lg text-brand-600">Ficha Profesional</h3>
            <p className="mt-2">Nombre: {service.professionalName}</p>
            <p>Especialidad: {service.title}</p>
            {/* Aquí iría más información del profesional */}
          </div>
        )}
        {activeTab === 'valoraciones' && (
          <div>
            <h3 className="font-bold text-lg">Valoraciones</h3>
            <p className="mt-2">Próximamente: Aquí se mostrarán las valoraciones de los usuarios.</p>
          </div>
        )}
      </div>
    </div>
  );
}
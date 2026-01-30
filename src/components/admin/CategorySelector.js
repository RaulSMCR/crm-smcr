'use client';

import { useState } from 'react';

/**
 * @param {Array} categories - El árbol de categorías (Padres con children[])
 * @param {Array} selectedIds - Array de IDs seleccionados ej: ['uuid-1', 'uuid-2']
 * @param {Function} onChange - Función que recibe el nuevo array de IDs
 */
export default function CategorySelector({ categories, selectedIds = [], onChange }) {
  // Estado para controlar qué grupos están expandidos (por defecto todos cerrados o abiertos según prefieras)
  // Aquí iniciamos con todos los padres expandidos para que lo veas rápido.
  const [expandedGroups, setExpandedGroups] = useState(
    categories.map(c => c.id)
  );

  const toggleGroup = (id) => {
    setExpandedGroups(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleCheck = (id) => {
    const isSelected = selectedIds.includes(id);
    let newSelection;

    if (isSelected) {
      // Si ya estaba, lo quitamos
      newSelection = selectedIds.filter(itemId => itemId !== id);
    } else {
      // Si no estaba, lo agregamos
      newSelection = [...selectedIds, id];
    }

    // Devolvemos la nueva selección al componente padre
    onChange(newSelection);
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-4 max-h-[400px] overflow-y-auto shadow-inner">
      <div className="space-y-4">
        {categories.map((parent) => (
          <div key={parent.id} className="select-none">
            {/* --- PADRE --- */}
            <div className="flex items-center gap-2 mb-1">
              {/* Botón para expandir/colapsar */}
              <button
                type="button"
                onClick={() => toggleGroup(parent.id)}
                className="text-gray-400 hover:text-brand-600 focus:outline-none transition-colors"
              >
                {expandedGroups.includes(parent.id) ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              {/* Checkbox del Padre */}
              <input
                type="checkbox"
                id={parent.id}
                checked={selectedIds.includes(parent.id)}
                onChange={() => handleCheck(parent.id)}
                className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 cursor-pointer"
              />
              <label 
                htmlFor={parent.id} 
                className="font-semibold text-gray-800 cursor-pointer hover:text-brand-700 text-sm"
              >
                {parent.name}
              </label>
            </div>

            {/* --- HIJOS (Renderizado Condicional) --- */}
            {expandedGroups.includes(parent.id) && (
              <div className="ml-8 space-y-2 border-l-2 border-gray-100 pl-3 mt-1">
                {parent.children.map((child) => (
                  <div key={child.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={child.id}
                      checked={selectedIds.includes(child.id)}
                      onChange={() => handleCheck(child.id)}
                      className="w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-500 cursor-pointer"
                    />
                    <label 
                      htmlFor={child.id} 
                      className="text-sm text-gray-600 cursor-pointer hover:text-gray-900"
                    >
                      {child.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
// src/components/ScheduleButton.js
'use client'; // Este componente necesita saber si el usuario ha iniciado sesión en el navegador

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Cookies from 'js-cookie'; // Usamos esta librería para leer la cookie de sesión

export default function ScheduleButton({ professionalId, isPrimary = true }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Al cargar el componente, revisa si la cookie 'sessionToken' existe
    const token = Cookies.get('sessionToken');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  // Si el usuario ha iniciado sesión, el botón lleva directamente a la página de agendamiento
  if (isLoggedIn) {
    return (
      <Link 
        href={`/agendar/${professionalId}`} 
        className={`font-bold px-8 py-3 rounded-md text-lg transition duration-300 ${
          isPrimary 
          ? 'bg-brand-primary text-white hover:bg-opacity-90' 
          : 'bg-brand-secondary text-white hover:bg-opacity-90'
        }`}
      >
        Agendar Cita
      </Link>
    );
  }

  // Si el usuario NO ha iniciado sesión, el botón lo lleva a la página de registro
  return (
    <Link 
      href="/registro" 
      className={`font-bold px-8 py-3 rounded-md text-lg transition duration-300 ${
        isPrimary 
        ? 'bg-brand-primary text-white hover:bg-opacity-90' 
        : 'bg-brand-secondary text-white hover:bg-opacity-90'
      }`}
    >
      Registrarse para Agendar
    </Link>
  );
}
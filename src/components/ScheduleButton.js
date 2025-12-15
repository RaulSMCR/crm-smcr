// src/components/SmartScheduleButton.js
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

export default function SmartScheduleButton({ professionalId }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = Cookies.get('sessionToken');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  // Si el usuario está logueado → ir directo al calendario del profesional
  if (isLoggedIn) {
    return (
      <Link
        href={`/perfil/${professionalId}/calendar`}
        className="bg-brand-primary text-white font-bold px-8 py-3 rounded-md text-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
      >
        Agendar Cita
      </Link>
    );
  }

  // Si NO está logueado → ir a registro de usuario con redirect de vuelta al calendario
  return (
    <Link
      href={`/registro/usuario?redirect=/perfil/${professionalId}/calendar`}
      className="bg-brand-secondary text-white font-bold px-8 py-3 rounded-md text-lg hover:bg-opacity-90 transition-transform transform hover:scale-105"
    >
      Registrarse para Agendar
    </Link>
  );
}

// src/components/SmartScheduleButton.js
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';

export default function SmartScheduleButton({ professionalId }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Verificamos la cookie de sesión
    const token = Cookies.get('sessionToken');
    if (token) {
      setIsLoggedIn(true);
    }
    setMounted(true);
  }, []);

  // Evitar desajustes de hidratación (SSR vs CSR)
  if (!mounted) return <div className="h-[52px] w-48 bg-gray-100 animate-pulse rounded-md" />;

  // CASO A: Usuario autenticado -> Flujo directo a la agenda interna
  if (isLoggedIn) {
    return (
      <Link
        href={`/agendar/${professionalId}`}
        className="bg-blue-600 text-white font-bold px-8 py-3 rounded-xl text-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
      >
        <span>📅</span> Agendar Cita
      </Link>
    );
  }

  // CASO B: Usuario anónimo -> Flujo de captación (Registro/Login)
  // Usamos el parámetro 'next' o 'redirect' para asegurar el retorno
  const redirectPath = encodeURIComponent(`/agendar/${professionalId}`);
  
  return (
    <Link
      href={`/registro/usuario?redirect=${redirectPath}`}
      className="bg-white text-blue-600 border-2 border-blue-600 font-bold px-8 py-3 rounded-xl text-lg hover:bg-blue-50 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2"
    >
      <span>🔐</span> Registrarse para Agendar
    </Link>
  );
}
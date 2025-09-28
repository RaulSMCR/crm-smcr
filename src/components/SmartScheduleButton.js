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

  if (isLoggedIn) {
    return (
      <Link href={`/agendar/${professionalId}`} className="bg-brand-primary ...">
        Agendar Cita
      </Link>
    );
  }

  // --- THIS IS THE KEY CHANGE ---
  // We add '?redirect=/agendar/PROFESSIONAL_ID' to the URL
  return (
    <Link href={`/registro?redirect=/agendar/${professionalId}`} className="bg-brand-secondary ...">
      Registrarse para Agendar
    </Link>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { guardarCredencialesGoogle } from '@/actions/google-connect-actions';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Procesando conexión con Google...');

  useEffect(() => {
    // 1. Capturamos el código de la URL
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('Error: El usuario denegó el acceso.');
      setTimeout(() => router.push('/panel/profesional'), 3000);
      return;
    }

    if (!code) {
      setStatus('Error: No se recibió código de Google.');
      return;
    }

    // 2. Enviamos el código al servidor (Server Action)
    async function exchangeCode() {
      // AQUÍ: Necesitas pasar el ID del profesional. 
      // Si el usuario está logueado, idealmente la Server Action debería 
      // obtener el ID de la sesión (cookies) y no recibirlo por parámetro por seguridad.
      // Por ahora, asumiremos que tu sistema de sesión maneja esto o que 
      // pasamos el ID de alguna forma segura.
      
      // Nota: Para este ejemplo rápido, asumo que la session se valida dentro de la action
      // o que el ID viene en un estado global.
      // Si no tienes auth global aún, la action 'guardarCredencialesGoogle' 
      // debería leer la cookie de sesión del profesional.
      
      const professionalId = "ID_DEL_PROFESIONAL_LOGUEADO"; // 👈 OJO AQUÍ

      const resultado = await guardarCredencialesGoogle(code, professionalId);

      if (resultado.success) {
        setStatus('¡Conexión exitosa! Redirigiendo...');
        router.push('/panel/profesional'); // O donde quieras mandarlo
        router.refresh(); // Actualiza la UI para mostrar que ya está conectado
      } else {
        setStatus('Error al guardar credenciales: ' + resultado.error);
      }
    }

    exchangeCode();
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-xl shadow-md text-center">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800">{status}</h2>
        <p className="text-gray-500 mt-2">Por favor no cierres esta ventana.</p>
      </div>
    </div>
  );
}
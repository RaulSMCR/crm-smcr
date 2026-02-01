// src/app/verificar-email/page.js
import Link from 'next/link';
import { verifyEmail } from '@/actions/auth-actions';

export default async function VerificarEmailPage({ searchParams }) {
  const token = searchParams?.token;

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md w-full border border-gray-100">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace inválido</h1>
          <p className="text-gray-600 mb-6">No se encontró un token de verificación en la URL.</p>
          <Link href="/" className="text-blue-600 font-medium hover:underline">Volver al inicio</Link>
        </div>
      </main>
    );
  }

  // Ejecutamos la verificación en el servidor
  const result = await verifyEmail(token);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full border border-gray-100">
        
        {result.success ? (
          <>
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Email Verificado!</h1>
            <p className="text-gray-600 mb-6">
              Gracias por confirmar tu correo <strong>{result.email}</strong>.
              {result.role === 'PROFESSIONAL' 
                ? " Tu cuenta ahora está pendiente de aprobación por un administrador."
                : " Ya puedes acceder a tu cuenta."}
            </p>
            
            <Link 
              href="/ingresar" 
              className="block w-full bg-blue-900 text-white font-bold py-3 rounded-lg hover:bg-black transition"
            >
              Iniciar Sesión
            </Link>
          </>
        ) : (
          <>
            <div className="text-red-500 text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error de Verificación</h1>
            <p className="text-gray-600 mb-6">
              {result.error || "El enlace ha expirado o ya fue utilizado."}
            </p>
            <Link href="/ingresar" className="text-blue-600 font-medium hover:underline">
              Volver a intentar
            </Link>
          </>
        )}

      </div>
    </main>
  );
}
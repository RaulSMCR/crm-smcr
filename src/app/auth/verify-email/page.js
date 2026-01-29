import Link from 'next/link';
import { verifyEmailToken } from '@/actions/verify-email-action';

export const metadata = {
  title: 'Verificación de Correo | CRM-SMCR',
};

export default async function VerifyEmailPage({ searchParams }) {
  const token = searchParams?.token;

  // Ejecutamos la lógica ANTES de renderizar (Server-Side)
  // Esto evita el parpadeo de "Cargando..." y el problema del doble fetch.
  const result = await verifyEmailToken(token);
  
  const isSuccess = !result.error;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
        
        {/* Icono de Estado */}
        <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full mb-6 ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
          {isSuccess ? (
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isSuccess ? '¡Verificación Exitosa!' : 'Verificación Fallida'}
        </h1>
        
        <p className="text-gray-600 mb-8">
          {result.message || result.error}
        </p>

        <div className="space-y-3">
          {isSuccess ? (
            <Link
              href="/login"
              className="block w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Iniciar Sesión
            </Link>
          ) : (
            <Link
              href="/auth/resend-verification" // (Opcional: ruta futura si quieres crearla)
              className="block w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Volver al inicio
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

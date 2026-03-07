// src/app/verificar-email/page.js
import Link from 'next/link';
import { verifyEmail } from '@/actions/auth-actions';

export default async function VerificarEmailPage({ searchParams }) {
  const token = searchParams?.token;

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-md w-full border border-gray-100">
          <div className="text-red-500 text-5xl mb-4">‚ö†Ô∏è</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace de verificaciÛn no v·lido</h1>
          <p className="text-gray-600 mb-6">No se encontrÛ un token de verificaciÛn en la URL. Para continuar avanzando con seguridad, utilice el enlace enviado por correo.</p>
          <Link href="/" className="text-blue-600 font-medium hover:underline">Volver al inicio</Link>
        </div>
      </main>
    );
  }

  // Ejecutamos la verificaci√≥n en el servidor
  const result = await verifyEmail(token);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md w-full border border-gray-100">
        
        {result.success ? (
          <>
            <div className="text-green-500 text-6xl mb-4">‚úÖ</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Correo verificado con Èxito</h1>
            <p className="text-gray-600 mb-6">
              Gracias por confirmar su correo <strong>{result.email}</strong>.
              {result.role === 'PROFESSIONAL' 
                ? "  Su cuenta contin˙a avanzando y ahora se encuentra pendiente de aprobaciÛn administrativa para resguardar la calidad de la atenciÛn."
                : "  Ya puede acceder a su cuenta y continuar con su proceso."}
            </p>
            
            <Link 
              href="/ingresar" 
              className="block w-full bg-blue-900 text-white font-bold py-3 rounded-lg hover:bg-black transition"
            >
              Ingresar
            </Link>
          </>
        ) : (
          <>
            <div className="text-red-500 text-6xl mb-4">‚ùå</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">No fue posible completar la verificaciÛn</h1>
            <p className="text-gray-600 mb-6">
              {result.error || "El enlace expirÛ o ya fue utilizado. Puede solicitar uno nuevo para continuar avanzando con seguridad."}
            </p>
            <Link href="/ingresar" className="text-blue-600 font-medium hover:underline">
              Intentar nuevamente
            </Link>
          </>
        )}

      </div>
    </main>
  );
}


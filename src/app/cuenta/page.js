// src/app/cuenta/page.js
import Link from 'next/link';

export default function CuentaPage() {
  return (
    <div className="bg-gray-50 py-12">
      <div className="container mx-auto px-6">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-10">
          Accede a tu Cuenta
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Tarjeta de Login */}
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h2 className="text-2xl font-semibold mb-4">Ya tengo una cuenta</h2>
            <p className="text-gray-600 mb-6">Ingresa para ver tu historial y agendar nuevas citas.</p>
            <Link href="/login" className="w-full inline-block bg-brand-600 text-accent-300 px-6 py-3 rounded-md font-semibold hover:bg-brand-900">
              Iniciar Sesión
            </Link>
          </div>

          {/* Tarjeta de Registro */}
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h2 className="text-2xl font-semibold mb-4">Soy un nuevo usuario</h2>
            <p className="text-gray-600 mb-6">Crea una cuenta para empezar tu camino hacia el bienestar.</p>
            <Link href="/registro" className="w-full inline-block bg-brand-600 text-accent-300 px-6 py-3 rounded-md font-semibold hover:bg-brand-900">
              Registrarme
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
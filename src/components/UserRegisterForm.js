'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mantenemos los nombres del estado sincronizados con el schema de Prisma
  const [formData, setFormData] = useState({
    name: '',
    identification: '',
    birthDate: '',
    gender: '',
    interests: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (formData.password !== formData.confirmPassword) {
      setMessage({ text: 'Las contraseñas no coinciden.', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Si la API devuelve un token, lo seteamos para que SmartScheduleButton lo detecte
        if (data.token) {
          Cookies.set('sessionToken', data.token, { expires: 7 });
        }

        const redirectUrl = searchParams.get('redirect');
        
        // Redirección inteligente: decodificamos por si viene con caracteres especiales
        if (redirectUrl) {
          router.push(decodeURIComponent(redirectUrl));
        } else {
          router.push('/dashboard');
        }
        router.refresh();
      } else {
        setMessage({ text: data.error || 'Ocurrió un error en el registro.', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'No se pudo conectar con el servidor.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Crea tu Cuenta de Usuario</h2>
      <p className="text-gray-500 mb-8 text-sm">Ingresa tus datos para acceder a los servicios de SMCR.</p>

      {message.text && (
        <div className={`p-4 mb-6 rounded-xl text-sm border ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-gray-700 font-semibold text-sm mb-2">Nombre Completo</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold text-sm mb-2">Identificación (Cédula)</label>
          <input type="text" name="identification" value={formData.identification} onChange={handleChange} required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold text-sm mb-2">Fecha de Nacimiento</label>
          <input type="date" name="birthDate" value={formData.birthDate} onChange={handleChange} required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold text-sm mb-2">Teléfono de Contacto</label>
          <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>

        <div>
          <label className="block text-gray-700 font-semibold text-sm mb-2">Género</label>
          <select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white">
            <option value="">Seleccionar...</option>
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="no-binario">No-binario</option>
            <option value="otro">Otro</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-700 font-semibold text-sm mb-2">Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>
      </div>

      <div className="mt-6">
        <label className="block text-gray-700 font-semibold text-sm mb-2">Intereses en Salud Mental</label>
        <textarea name="interests" value={formData.interests} onChange={handleChange} rows="2" className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="Ej: Ansiedad, terapia de pareja..." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div>
          <label className="block text-gray-700 font-semibold text-sm mb-2">Contraseña</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange} required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>
        <div>
          <label className="block text-gray-700 font-semibold text-sm mb-2">Confirmar Contraseña</label>
          <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-8 hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
      >
        {loading ? 'Creando cuenta...' : 'Crear Cuenta y Continuar'}
      </button>
    </form>
  );
}

// Next.js requiere Suspense para usar useSearchParams en componentes de cliente
export default function UserRegisterForm() {
  return (
    <Suspense fallback={<div className="text-center p-10">Cargando formulario...</div>}>
      <RegisterFormContent />
    </Suspense>
  );
}
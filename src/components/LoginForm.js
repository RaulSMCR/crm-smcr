// src/components/LoginForm.js
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // --- ¡ESTA ES LA LÍNEA CRÍTICA QUE SOLUCIONA EL PROBLEMA! ---
        // Le da la orden al navegador de ir al dashboard correcto.
        if (data.role === 'USER') {
          router.push('/dashboard');
        } else if (data.role === 'PROFESSIONAL') {
          router.push('/dashboard-profesional');
        } else if (data.role === 'ADMIN') {
            router.push('/admin');
        }
      } else {
        setMessage(data.message || 'Ocurrió un error');
      }
    } catch (error) {
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  return (
    <form onSubmit={handleSubmit} method="POST" className="bg-white p-8 rounded-lg shadow-md border max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Iniciar Sesión</h2>
      
      <div className="mb-4">
        <label htmlFor="email" className="block text-gray-700 font-medium mb-2">Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
      </div>
      
      <div className="mb-6">
        <label htmlFor="password" className="block text-gray-700 font-medium mb-2">Contraseña</label>
        <input type="password" name="password" value={formData.password} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
      </div>
      
      <button type="submit" className="w-full bg-brand-primary text-white p-3 rounded-lg font-semibold hover:bg-opacity-90">
        Entrar
      </button>
      
      {message && <p className="mt-4 text-center text-sm text-red-600">{message}</p>}
      
      <p className="text-sm text-center text-gray-600 mt-4">
        ¿No tienes una cuenta?{' '}
        <Link href="/registro" className="text-brand-primary font-semibold hover:underline">
          Regístrate aquí
        </Link>
      </p>
    </form>
  );
}
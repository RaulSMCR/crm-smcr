// src/components/LoginForm.js
'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function LoginForm() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Login attempt:', formData);
    alert('Intento de login. Revisa la consola para ver los datos.');
    // Here is where we would connect to the backend for authentication.
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md border max-w-md mx-auto">
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

      <p className="text-sm text-center text-gray-600 mt-4">
        ¿No tienes una cuenta?{' '}
        <Link href="/registro" className="text-brand-primary font-semibold hover:underline">
          Regístrate aquí
        </Link>
      </p>
    </form>
  );
}
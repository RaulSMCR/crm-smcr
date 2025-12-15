// src/components/ProfessionalRegisterForm.js
'use client';
import { useState } from 'react';

export default function ProfessionalRegisterForm() {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    profesion: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (formData.password !== formData.confirmPassword) {
      setMessage('Las contraseñas no coinciden.');
      return;
    }

    try {
      const response = await fetch('/api/auth/register-professional', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage('Gracias por tu interés. Hemos recibido tus datos y te contactaremos pronto.');
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Ocurrió un error al enviar la solicitud.');
      }
    } catch (error) {
      console.error('Submission error:', error);
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-8 rounded-lg shadow-md border max-w-2xl mx-auto"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Registro para Profesionales
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="mb-4">
          <label
            htmlFor="nombreCompleto"
            className="block text-gray-700 font-medium mb-2"
          >
            Nombre Completo
          </label>
          <input
            type="text"
            name="nombreCompleto"
            value={formData.nombreCompleto}
            onChange={handleChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="profesion"
            className="block text-gray-700 font-medium mb-2"
          >
            Profesión
          </label>
          <input
            type="text"
            name="profesion"
            value={formData.profesion}
            onChange={handleChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-gray-700 font-medium mb-2"
          >
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="telefono"
            className="block text-gray-700 font-medium mb-2"
          >
            Teléfono
          </label>
          <input
            type="tel"
            name="telefono"
            value={formData.telefono}
            onChange={handleChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
        <div>
          <label
            htmlFor="cv"
            className="block text-gray-700 font-medium mb-2"
          >
            Subir CV (PDF)
          </label>
          <input
            type="file"
            name="cv"
            accept=".pdf"
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20"
          />
        </div>

        <div>
          <label
            htmlFor="carta"
            className="block text-gray-700 font-medium mb-2"
          >
            Subir Carta de Presentación (PDF)
          </label>
          <input
            type="file"
            name="carta"
            accept=".pdf"
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="password">Contraseña</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword">Confirmar Contraseña</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full btn btn-primary mt-2"
      >
        Enviar Solicitud
      </button>

      {message && (
        <p className="mt-4 text-center text-sm text-red-600">
          {message}
        </p>
      )}
    </form>
  );
}

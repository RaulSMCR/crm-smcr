'use client';
import { useState } from 'react';

export default function UserRegisterForm() {
  const [formData, setFormData] = useState({
    nombreCompleto: '',
    identificacion: '',
    fechaNacimiento: '',
    intereses: '',
    email: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState(''); // For success/error messages

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (formData.password !== formData.confirmPassword) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage('¡Registro exitoso! Ya puedes iniciar sesión.');
      } else {
        const errorData = await response.json();
        setMessage(errorData.message || 'Ocurrió un error en el registro.');
      }
    } catch (error) {
      setMessage('No se pudo conectar con el servidor.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md border max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Crea tu Cuenta de Usuario</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="mb-4">
          <label htmlFor="nombreCompleto" className="block text-gray-700 font-medium mb-2">Nombre Completo</label>
          <input type="text" id="nombreCompleto" name="nombreCompleto" value={formData.nombreCompleto} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
        </div>
        <div className="mb-4">
          <label htmlFor="identificacion" className="block text-gray-700 font-medium mb-2">Identificación (Cédula)</label>
          <input type="text" id="identificacion" name="identificacion" value={formData.identificacion} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
        </div>
        <div className="mb-4">
          <label htmlFor="fechaNacimiento" className="block text-gray-700 font-medium mb-2">Fecha de Nacimiento</label>
          <input type="date" id="fechaNacimiento" name="fechaNacimiento" value={formData.fechaNacimiento} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
        </div>
         <div className="mb-4">
          <label htmlFor="telefono" className="block text-gray-700 font-medium mb-2">Teléfono de Contacto</label>
          <input type="tel" id="telefono" name="telefono" value={formData.telefono} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="intereses" className="block text-gray-700 font-medium mb-2">Intereses en Salud Mental</label>
        <textarea id="intereses" name="intereses" value={formData.intereses} onChange={handleChange} rows="3" placeholder="Ej: Ansiedad, terapia de pareja, crecimiento personal..." className="w-full p-2 border border-gray-300 rounded-md"></textarea>
      </div>

      <div className="mb-4">
        <label htmlFor="email" className="block text-gray-700 font-medium mb-2">Email</label>
        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="password" className="block text-gray-700 font-medium mb-2">Contraseña</label>
          <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-gray-700 font-medium mb-2">Confirmar Contraseña</label>
          <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
        </div>
      </div>
      
      <button type="submit" className="w-full bg-brand-primary text-white p-3 rounded-lg font-semibold hover:bg-opacity-90">
        Crear Cuenta
      </button>

      {message && <p className="mt-4 text-center text-sm text-red-600">{message}</p>}
    </form>
  );
}
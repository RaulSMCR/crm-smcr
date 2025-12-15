// src/components/ContactForm.js
'use client';
import { useState } from 'react';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    alert('Mensaje enviado. Revisa la consola para ver los datos.');
    // Here is where we would later add the logic to send an email.
  };

  return (
    <form onSubmit={handleSubmit} className="bg-neutral-200 p-8 rounded-lg shadow-md border">
      <h2 className="text-2xl font-bold text-brand-600 mb-6">Envíanos un Mensaje</h2>
      <div className="mb-4">
        <label htmlFor="name" className="block text-brand-600 font-medium mb-2">Tu Nombre</label>
        <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
      </div>
      <div className="mb-4">
        <label htmlFor="email" className="block text-brand-600 font-medium mb-2">Tu Email</label>
        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required className="w-full p-2 border border-gray-300 rounded-md"/>
      </div>
      <div className="mb-6">
        <label htmlFor="message" className="block text-brand-600 font-medium mb-2">Mensaje</label>
        <textarea id="message" name="message" value={formData.message} onChange={handleChange} required rows="5" className="w-full p-2 border border-gray-300 rounded-md"></textarea>
      </div>
      <button type="submit" className="w-full bg-neutral-250 text-brand-600 p-3 rounded-2xg font-semibold hover:bg-opacity-90">
        Enviar Mensaje
      </button>
      <div className="text-xs text-brand-600 mt-4 text-center space-y-2">
        <p>Se le contactará tan pronto haya un profesional disponible (1-2 horas en días hábiles). Fines de semana se responderá al lunes siguiente.</p>
        <p className="font-bold bg-accent-600">Si se trata de una emergencia, por favor contacte al 911.</p>
      </div>
    </form>
  );
}
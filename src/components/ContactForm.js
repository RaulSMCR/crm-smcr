// src/components/ContactForm.js
"use client";

import { useState } from "react";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log("Form submitted:", formData);
    alert("Mensaje enviado con exito. Revise la consola para ver los datos.");
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-neutral-200 p-8 shadow-md">
      <h2 className="mb-6 text-2xl font-bold text-brand-700">Envíanos un Mensaje</h2>

      <div className="mb-4">
        <label htmlFor="name" className="mb-2 block font-medium text-brand-700">
          Nombre completo
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full rounded-md border border-neutral-300 p-2"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="email" className="mb-2 block font-medium text-brand-700">
          Correo electronico
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full rounded-md border border-neutral-300 p-2"
        />
      </div>

      <div className="mb-6">
        <label htmlFor="message" className="mb-2 block font-medium text-brand-700">
          Mensaje
        </label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows="5"
          className="w-full rounded-md border border-neutral-300 p-2"
        ></textarea>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-brand-600 p-3 font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Enviar Mensaje
      </button>

      <div className="mt-4 space-y-2 text-center text-xs text-brand-700">
        <p>
          Se le contactará tan pronto haya un profesional disponible (1-2 horas en días hábiles).
          Fines de semana se responderá al lunes siguiente.
        </p>
        <p className="emergency-alert rounded-md border px-3 py-2 font-bold">
          Si se trata de una emergencia, por favor contacte al 911.
        </p>
      </div>
    </form>
  );
}


"use client";

import { useCallback, useState } from "react";
import Toast from "@/components/ui/Toast";
import { trackEvent } from "@/lib/analytics";
import { trackContact } from "@/lib/meta-pixel";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [toast, setToast] = useState(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    trackEvent('contact_form', {});
    trackContact();
    setFormData({ name: "", email: "", message: "" });
    setToast({
      message: "Despejaremos su consulta tan pronto sea posible. Gracias por contactarnos",
      type: "success",
    });
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-neutral-300 bg-appbg p-8 shadow-card"
      >
        <h2 className="mb-6 text-2xl font-bold text-brand-900">Envíanos un mensaje</h2>

        <div className="mb-4">
          <label htmlFor="name" className="mb-2 block font-medium text-brand-900">
            Nombre completo
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-neutral-950"
          />
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="mb-2 block font-medium text-brand-900">
            Correo electrónico
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-neutral-950"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="message" className="mb-2 block font-medium text-brand-900">
            Mensaje
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows="5"
            className="w-full rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-neutral-950"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Enviar mensaje
        </button>

        <div className="mt-4 space-y-2 text-center text-xs text-brand-900">
          <p>
            Se le contactará tan pronto haya un profesional disponible (1-2 horas en días hábiles).
            Los fines de semana se responderá el lunes siguiente.
          </p>
          <p className="rounded-xl border border-accent-300 bg-accent-100 px-3 py-2 font-bold text-accent-950">
            Si se trata de una emergencia, por favor contacte al 911.
          </p>
        </div>
      </form>

      <Toast message={toast?.message} type={toast?.type} onDismiss={dismissToast} />
    </>
  );
}

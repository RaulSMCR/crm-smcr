"use client";

import { useCallback, useRef, useState } from "react";
import Toast from "@/components/ui/Toast";
import AuthTurnstile, { CAPTCHA_ENABLED } from "@/components/AuthTurnstile";
import { trackEvent } from "@/lib/analytics";
import { trackContact } from "@/lib/meta-pixel";
import { getMarketingAttributionRaw } from "@/lib/marketing-attribution-client";

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [status, setStatus] = useState("idle"); // idle | submitting
  const [captchaToken, setCaptchaToken] = useState("");
  const [toast, setToast] = useState(null);
  const turnstileRef = useRef(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const submitBlocked = status === "submitting" || (CAPTCHA_ENABLED && !captchaToken);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (CAPTCHA_ENABLED && !captchaToken) {
      setToast({ message: "Completá la verificación de seguridad antes de enviar.", type: "error" });
      return;
    }

    setStatus("submitting");

    const attribution = getMarketingAttributionRaw();

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          channel: "CONTACT_FORM",
          captchaToken: captchaToken || "",
          ...attribution,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        // Los eventos de conversión solo se disparan cuando el lead se guardó.
        trackEvent("contact_form", {});
        trackContact();
        setFormData({ name: "", email: "", phone: "", message: "" });
        setCaptchaToken("");
        turnstileRef.current?.reset();
        setToast({
          message: "Despejaremos su consulta tan pronto sea posible. Gracias por contactarnos.",
          type: "success",
        });
      } else {
        turnstileRef.current?.reset();
        setCaptchaToken("");
        setToast({ message: data.error || "No se pudo enviar el mensaje. Intentá de nuevo.", type: "error" });
      }
    } catch {
      turnstileRef.current?.reset();
      setCaptchaToken("");
      setToast({ message: "No se pudo conectar con el servidor. Verificá tu conexión.", type: "error" });
    } finally {
      setStatus("idle");
    }
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

        <div className="mb-4">
          <label htmlFor="phone" className="mb-2 block font-medium text-brand-900">
            Teléfono <span className="font-normal text-neutral-500">(opcional)</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Para poder contactarte más rápido"
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

        {CAPTCHA_ENABLED && (
          <div className="mb-6">
            <AuthTurnstile ref={turnstileRef} onToken={setCaptchaToken} />
          </div>
        )}

        <button
          type="submit"
          disabled={submitBlocked}
          className="w-full rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "submitting" ? "Enviando…" : "Enviar mensaje"}
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

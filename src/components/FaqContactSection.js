'use client';

import { useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

const SUBJECT_OPTIONS = [
  { value: 'tech',          label: 'Problema técnico con mi cuenta' },
  { value: 'registro',      label: 'Duda sobre el registro' },
  { value: 'institucional', label: 'Asunto institucional / Profesionales' },
];

// La variable NEXT_PUBLIC_* se inyecta en el bundle al arrancar el servidor.
// Si está vacía el widget no se muestra y el envío no requiere token.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const CAPTCHA_ENABLED = SITE_KEY.length > 0;

export default function FaqContactSection() {
  const [isOpen,       setIsOpen]       = useState(false);
  const [status,       setStatus]       = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [errorMsg,     setErrorMsg]     = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef(null);

  // El botón solo se bloquea por falta de token cuando el captcha está activo
  const submitBlocked = status === 'submitting' || (CAPTCHA_ENABLED && !captchaToken);

  async function handleSubmit(e) {
    e.preventDefault();

    if (CAPTCHA_ENABLED && !captchaToken) {
      setErrorMsg('Completá la verificación de seguridad antes de enviar.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMsg('');

    const fd = new FormData(e.currentTarget);
    const payload = {
      nombre:       fd.get('nombre'),
      email:        fd.get('email'),
      asunto:       fd.get('asunto'),
      mensaje:      fd.get('mensaje'),
      captchaToken: captchaToken || '',
    };

    try {
      const res  = await fetch('/api/contact-faq', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus('success');
      } else {
        setErrorMsg(data.error || 'Ocurrió un error al enviar el mensaje.');
        setStatus('error');
        turnstileRef.current?.reset();
        setCaptchaToken('');
      }
    } catch {
      setErrorMsg('No se pudo conectar con el servidor. Verificá tu conexión e intentá de nuevo.');
      setStatus('error');
      turnstileRef.current?.reset();
      setCaptchaToken('');
    }
  }

  return (
    <section className="pb-20">
      <div className="container max-w-3xl">
        <div className="card px-8 py-10 text-center">
          <h2 className="text-2xl font-bold text-neutral-900">
            ¿No encontraste lo que buscabas?
          </h2>
          <p className="mt-2 text-sm text-neutral-600 max-w-md mx-auto">
            Si tenés una consulta técnica o institucional, podés enviarnos un
            mensaje y te responderemos a la brevedad.
          </p>

          {/* Botón disparador */}
          <div className="mt-6">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls="faq-contact-panel"
              onClick={() => setIsOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              {isOpen ? 'Cerrar formulario' : 'Tengo una consulta técnica o institucional'}
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Panel del formulario */}
          <div
            id="faq-contact-panel"
            aria-hidden={!isOpen}
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isOpen
                ? 'max-h-[1000px] opacity-100 pointer-events-auto'
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            {/* ── Estado de éxito ─────────────────────────────────────────── */}
            {status === 'success' ? (
              <div className="mt-8 rounded-xl border border-brand-200 bg-brand-50 px-6 py-10 text-center">
                <svg
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="mx-auto w-10 h-10 text-brand-600"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
                    clipRule="evenodd"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-semibold text-brand-800">
                  Mensaje enviado con éxito
                </h3>
                <p className="mt-2 text-sm text-brand-700">
                  Recibimos tu consulta y te responderemos a la brevedad en la
                  dirección de correo que indicaste.
                </p>
              </div>
            ) : (
              /* ── Formulario ─────────────────────────────────────────────── */
              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-8 text-left flex flex-col gap-5"
              >
                {/* Nombre */}
                <div>
                  <label htmlFor="faq-cf-nombre" className="label">
                    Nombre
                  </label>
                  <input
                    id="faq-cf-nombre"
                    name="nombre"
                    type="text"
                    autoComplete="name"
                    required
                    className="input mt-1"
                    placeholder="Tu nombre completo"
                  />
                </div>

                {/* Correo */}
                <div>
                  <label htmlFor="faq-cf-email" className="label">
                    Correo Electrónico
                  </label>
                  <input
                    id="faq-cf-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="input mt-1"
                    placeholder="tu@correo.com"
                  />
                </div>

                {/* Asunto */}
                <div>
                  <label htmlFor="faq-cf-asunto" className="label">
                    Asunto
                  </label>
                  <select
                    id="faq-cf-asunto"
                    name="asunto"
                    required
                    defaultValue=""
                    className="input mt-1"
                  >
                    <option value="" disabled hidden>
                      Seleccioná un asunto…
                    </option>
                    {SUBJECT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mensaje */}
                <div>
                  <label htmlFor="faq-cf-mensaje" className="label">
                    Mensaje
                  </label>
                  <textarea
                    id="faq-cf-mensaje"
                    name="mensaje"
                    rows={4}
                    required
                    className="input mt-1 resize-none"
                    placeholder="Describí tu consulta con el mayor detalle posible…"
                  />
                </div>

                {/* Turnstile — solo se monta si SITE_KEY está configurada */}
                {CAPTCHA_ENABLED && isOpen && (
                  <div>
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={SITE_KEY}
                      onSuccess={setCaptchaToken}
                      onExpire={() => setCaptchaToken('')}
                      onError={() => setCaptchaToken('')}
                      options={{ theme: 'light', language: 'es' }}
                    />
                  </div>
                )}

                {/* Mensaje de error */}
                {status === 'error' && (
                  <div
                    role="alert"
                    className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800"
                  >
                    {errorMsg}
                  </div>
                )}

                {/* Enviar */}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submitBlocked}
                    className="btn-primary px-6 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {status === 'submitting' ? 'Enviando…' : 'Enviar consulta'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

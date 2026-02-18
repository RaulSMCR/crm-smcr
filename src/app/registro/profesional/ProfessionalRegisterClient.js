"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { registerProfessional } from "@/actions/auth-actions";

export default function ProfessionalRegisterClient() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Teléfono obligatorio (para deshabilitar botón y validar)
  const [phone, setPhone] = useState("");

  // Estados para validación de contraseña
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passValid, setPassValid] = useState({
    length: false,
    number: false,
    special: false,
    match: false,
  });

  // Validar requisitos mientras escribe
  useEffect(() => {
    setPassValid({
      length: password.length >= 8,
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
      match: Boolean(password) && password === confirmPassword,
    });
  }, [password, confirmPassword]);

  // Validación de teléfono (mínimo 7 dígitos numéricos)
  const phoneDigits = useMemo(() => phone.replace(/\D/g, ""), [phone]);
  const phoneValid = phoneDigits.length >= 7;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.target);

    // 1) Validar teléfono (obligatorio)
    const phoneValue = String(formData.get("phone") || "").trim();
    const phoneDigitsLocal = phoneValue.replace(/\D/g, "");
    if (!phoneValue) {
      setError("Por favor ingresa tu teléfono / WhatsApp.");
      setLoading(false);
      return;
    }
    if (phoneDigitsLocal.length < 7) {
      setError("El teléfono parece inválido. Ingresa al menos 7 dígitos.");
      setLoading(false);
      return;
    }

    // 2) Validar contraseña (incluye carácter especial)
    if (
      !passValid.length ||
      !passValid.number ||
      !passValid.special ||
      !passValid.match
    ) {
      setError("Por favor, cumple con todos los requisitos de seguridad.");
      setLoading(false);
      return;
    }

    try {
      const res = await registerProfessional(formData);

      if (res?.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      router.push("/ingresar?registered=true");
    } catch (err) {
      setError("Ocurrió un error inesperado al registrar. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const canSubmit =
    phoneValid &&
    passValid.length &&
    passValid.number &&
    passValid.special &&
    passValid.match &&
    !loading;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 space-y-6"
    >
      {/* --- CAMPO OCULTO DE MARKETING --- */}
      <input
        type="hidden"
        name="acquisitionChannel"
        value="Formulario Web - Registro"
      />

      <div className="text-center pb-4 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900">Registro Profesional</h2>
        <p className="text-sm text-gray-500 mt-1">
          Crea tu cuenta segura y únete a la red.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-200 font-medium flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {/* 1. Datos Personales */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          1. Datos Personales
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Nombre Completo *
            </label>
            <input
              name="name"
              type="text"
              required
              autoComplete="name"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Dr. Juan Pérez"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Especialidad *
            </label>
            <input
              name="specialty"
              type="text"
              required
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Psicología"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Email Profesional *
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="nombre@ejemplo.com"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Teléfono / WhatsApp *
          </label>
          <input
            name="phone"
            type="tel"
            required
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+54 11..."
          />
          {!phoneValid && phone.length > 0 && (
            <p className="mt-1 text-xs text-red-600">
              Ingresa al menos 7 dígitos.
            </p>
          )}
        </div>
      </div>

      {/* 2. Seguridad */}
      <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          2. Seguridad de la Cuenta
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Contraseña *
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Confirmar Contraseña *
            </label>
            <input
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>

        {/* Checklist de Seguridad */}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mt-2">
          <div
            className={`flex items-center gap-1 ${
              passValid.length ? "text-green-600 font-bold" : ""
            }`}
          >
            {passValid.length ? "✓" : "○"} Mínimo 8 caracteres
          </div>

          <div
            className={`flex items-center gap-1 ${
              passValid.number ? "text-green-600 font-bold" : ""
            }`}
          >
            {passValid.number ? "✓" : "○"} Al menos un número
          </div>

          <div
            className={`flex items-center gap-1 ${
              passValid.special ? "text-green-600 font-bold" : ""
            }`}
          >
            {passValid.special ? "✓" : "○"} Carácter especial
          </div>

          <div
            className={`flex items-center gap-1 ${
              passValid.match ? "text-green-600 font-bold" : ""
            }`}
          >
            {passValid.match ? "✓" : "○"} Las contraseñas coinciden
          </div>
        </div>
      </div>

      {/* 3. Perfil y Documentos */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          3. Información Adicional
        </h3>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Biografía / Perfil
          </label>
          <textarea
            name="bio"
            rows="2"
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Breve presentación profesional..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Carta de Presentación
          </label>
          <textarea
            name="coverLetter"
            rows="2"
            className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Motivo de solicitud de ingreso..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Adjuntar CV (PDF)
          </label>
          <input
            name="cv"
            type="file"
            accept=".pdf,.doc,.docx"
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      </div>

      <div className="pt-4">
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-gray-900 text-white py-3.5 rounded-lg font-bold hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          {loading ? "Procesando..." : "Enviar Solicitud Profesional"}
        </button>
      </div>
    </form>
  );
}

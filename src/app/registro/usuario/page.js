// src/app/registro/usuario/page.js
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/actions/auth-actions";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { trackLead } from "@/lib/meta-pixel";

function isEmailFormatValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

export default function RegistroUsuarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Estados del formulario
  const [form, setForm] = useState({
    name: "",
    email: "",
    identification: "",
    birthDate: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gender: "",
    interests: "",
  });

  // --- VALIDACIONES DE CONTRASEÑA ---
  const passwordChecks = useMemo(() => {
    const pwd = form.password || "";
    return {
      length: pwd.length >= 8,
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      match: pwd && pwd === form.confirmPassword,
    };
  }, [form.password, form.confirmPassword]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "password" || name === "confirmPassword") setTouched(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setTouched(true);

    if (!String(form.name || "").trim()) {
      setErrorMsg("Falta el nombre completo para crear la cuenta.");
      return;
    }

    if (!String(form.email || "").trim()) {
      setErrorMsg("Falta el correo electrónico para proteger y validar el acceso.");
      return;
    }

    if (!isEmailFormatValid(form.email)) {
      setErrorMsg("El correo electrónico no tiene un formato válido.");
      return;
    }

    if (!String(form.phone || "").trim()) {
      setErrorMsg("Falta el teléfono de contacto para coordinar la atención de forma segura.");
      return;
    }

    if (!String(form.identification || "").trim()) {
      setErrorMsg("Falta la identificación para completar el registro seguro.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMsg("No fue posible completar la seguridad de la cuenta. Revise los requisitos de contraseña.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const res = await registerUser(formData);

      if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else if (res?.warning) {
        setErrorMsg(res.warning);
        setLoading(false);
      } else {
        trackEvent('sign_up', { method: 'email' });
        trackLead();
        router.push("/ingresar?registered=true");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error de conexión con el servidor. Por favor, intente nuevamente para continuar con seguridad.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* ENCABEZADO */}
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Registro de paciente
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Este registro permite avanzar con seguridad en la coordinación de citas y resguardar la continuidad del cuidado de cada paciente.</p>
        </div>

        {/* TARJETA PRINCIPAL */}
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 sm:px-10">
          {errorMsg && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
              <div className="flex">
                <div className="flex-shrink-0">⚠️</div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
                </div>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={onSubmit}>
            {/* SECCIÓN 1: DATOS BÁSICOS */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                Información Personal
              </h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                    Nombre Completo
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                    value={form.name}
                    onChange={handleChange}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                    Correo Electrónico
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                    value={form.email}
                    onChange={handleChange}
                  />
                </div>

                {/* ✅ TELÉFONO OBLIGATORIO */}
                <div className="sm:col-span-2">
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
                    Teléfono (obligatorio)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    inputMode="tel"
                    placeholder="+506 8888 8888"
                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="identification" className="block text-sm font-medium text-slate-700">
                    DNI / Cédula
                  </label>
                  <input
                    name="identification"
                    type="text"
                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                    value={form.identification}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="birthDate" className="block text-sm font-medium text-slate-700">
                    Fecha de Nacimiento
                  </label>
                  <input
                    id="birthDate"
                    name="birthDate"
                    type="date"
                    max={new Date().toISOString().split("T")[0]}
                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                    value={form.birthDate}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-slate-700">
                    Género
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                    value={form.gender}
                    onChange={handleChange}
                  >
                    <option value="">Prefiero no indicar</option>
                    <option value="femenino">Femenino</option>
                    <option value="masculino">Masculino</option>
                    <option value="no_binario">No binario</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="interests" className="block text-sm font-medium text-slate-700">
                    Intereses terapéuticos
                  </label>
                  <textarea
                    id="interests"
                    name="interests"
                    rows={3}
                    placeholder="Ej: manejo de ansiedad, terapia de pareja, autoestima..."
                    className="mt-1 block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3"
                    value={form.interests}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: SEGURIDAD */}
            <div className="pt-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
                Seguridad
              </h3>
              <div className="grid grid-cols-1 gap-y-6 gap-x-6 sm:grid-cols-2">
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                  <div className="relative mt-1">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 pr-16"
                      value={form.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <span className="text-xs font-semibold">{showPassword ? "OCULTAR" : "VER"}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Confirmar</label>
                  <div className="relative mt-1">
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      className={`block w-full rounded-lg shadow-sm focus:ring-indigo-500 sm:text-sm py-2.5 px-3 pr-16 transition-colors ${
                        touched && !passwordChecks.match
                          ? "border-red-300 focus:border-red-500 bg-red-50"
                          : "border-slate-300 focus:border-indigo-500"
                      }`}
                      value={form.confirmPassword}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <span className="text-xs font-semibold">{showConfirmPassword ? "OCULTAR" : "VER"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Checklist de Seguridad - Diseño Horizontal Compacto */}
              <div className="mt-4 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500 mb-2 font-medium">Requisitos de contraseña para proteger la información del paciente y avanzar con acceso seguro:</p>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge valid={passwordChecks.length} label="8+ caracteres" />
                  <StatusBadge valid={passwordChecks.number} label="Número" />
                  <StatusBadge valid={passwordChecks.special} label="Símbolo" />
                  <StatusBadge valid={passwordChecks.match} label="Coinciden" />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !isPasswordValid}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white transition-all
                  ${
                    loading || !isPasswordValid
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 hover:shadow-indigo-300"
                  }`}
              >
                {loading ? "Procesando registro..." : "Crear cuenta segura y avanzar"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Si ya dispone de una cuenta,{" "}
              <Link href="/ingresar" className="font-medium text-indigo-600 hover:text-indigo-500">
                ingrese aquí</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponente Estético
function StatusBadge({ valid, label }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${
        valid ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${valid ? "bg-green-500" : "bg-slate-400"}`}></span>
      {label}
    </span>
  );
}

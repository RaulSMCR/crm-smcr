// src/app/registro/usuario/page.js
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
// 👇 IMPORTANTE: Conectamos con la Server Action
import { registerUser } from "@/actions/auth-actions";

export default function RegistroUsuarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  const [showPassword, setShowPassword] = useState(false);

  // --- VALIDACIONES DE CONTRASEÑA EN TIEMPO REAL (UX) ---
  const passwordChecks = useMemo(() => {
    const pwd = form.password || "";
    return {
      length: pwd.length >= 8, // Ajustado a 8 para coincidir con backend (o 12 si prefieres estricto)
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      match: pwd && pwd === form.confirmPassword
    };
  }, [form.password, form.confirmPassword]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // Manejo de cambios en inputs
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // --- ENVÍO DEL FORMULARIO ---
  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    // Validación final en cliente
    if (!isPasswordValid) {
      setErrorMsg("Por favor, corrige los errores en la contraseña.");
      setLoading(false);
      return;
    }

    try {
      // Creamos FormData manualmente porque tenemos estado controlado
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // 👇 Llamada a la Server Action
      const res = await registerUser(formData);

      if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else {
        // Éxito -> Redirigir a /ingresar
        router.push("/ingresar?registered=true");
      }
    } catch (err) {
      setErrorMsg("Ocurrió un error inesperado. Intenta nuevamente.");
      setLoading(false);
    }
  }

  // Fecha máxima (hoy)
  const maxDate = new Date().toISOString().split("T")[0];

  return (
    <main className="mx-auto max-w-xl p-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Crear Cuenta</h1>
        <p className="text-gray-500 mt-2">Únete como paciente para gestionar tus citas.</p>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm font-medium text-red-700">⚠️ {errorMsg}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-5 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        
        {/* Nombre */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre Completo *</label>
          <input
            name="name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
            value={form.name}
            onChange={handleChange}
            placeholder="Tu nombre"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
          <input
            name="email"
            type="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
            value={form.email}
            onChange={handleChange}
            placeholder="tu@email.com"
            required
          />
        </div>

        {/* Identificación y Fecha */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Identificación</label>
              <input
                name="identification"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.identification}
                onChange={handleChange}
                placeholder="DNI / Cédula"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha de Nacimiento</label>
              <input
                name="birthDate"
                type="date"
                max={maxDate}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.birthDate}
                onChange={handleChange}
              />
            </div>
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
          <input
            name="phone"
            type="tel"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
            value={form.phone}
            onChange={handleChange}
            placeholder="+54 11..."
          />
        </div>

        <hr className="border-gray-100 my-2" />

        {/* Contraseña */}
        <div className="space-y-4">
            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña *</label>
                    <input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={form.password}
                        onChange={handleChange}
                        required
                    />
                </div>
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="mb-[5px] px-3 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                >
                    {showPassword ? "Ocultar" : "Ver"}
                </button>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmar Contraseña *</label>
                <input
                    name="confirmPassword"
                    type="password"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                />
            </div>

            {/* Checklist Visual de Seguridad */}
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 grid grid-cols-2 gap-2 text-xs">
                <span className={passwordChecks.length ? "text-green-600 font-bold" : "text-gray-500"}>
                    {passwordChecks.length ? "✓" : "○"} Mínimo 8 caracteres
                </span>
                <span className={passwordChecks.number ? "text-green-600 font-bold" : "text-gray-500"}>
                    {passwordChecks.number ? "✓" : "○"} Al menos un número
                </span>
                <span className={passwordChecks.special ? "text-green-600 font-bold" : "text-gray-500"}>
                    {passwordChecks.special ? "✓" : "○"} Carácter especial
                </span>
                <span className={passwordChecks.match ? "text-green-600 font-bold" : "text-gray-500"}>
                    {passwordChecks.match ? "✓" : "○"} Contraseñas coinciden
                </span>
            </div>
        </div>

        <hr className="border-gray-100 my-2" />

        {/* Extras (Género / Intereses) */}
        <div className="grid grid-cols-1 gap-4">
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Género (Opcional)</label>
                <input
                    name="gender"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={form.gender}
                    onChange={handleChange}
                    placeholder="Ej: Femenino, Masculino, No binario..."
                />
             </div>
             <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Intereses (Opcional)</label>
                <textarea
                    name="interests"
                    rows="2"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={form.interests}
                    onChange={handleChange}
                    placeholder="¿Buscas ayuda con ansiedad, depresión, nutrición?"
                />
             </div>
        </div>

        {/* Botón de Envío */}
        <button
          type="submit"
          disabled={loading || !isPasswordValid}
          className="w-full rounded-lg bg-brand-600 bg-blue-900 text-white px-4 py-3 font-bold transition hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          {loading ? "Creando usuario..." : "Registrarme"}
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
             ¿Ya tienes cuenta? <a href="/ingresar" className="text-blue-600 underline">Inicia sesión aquí</a>
        </p>

      </form>
    </main>
  );
}
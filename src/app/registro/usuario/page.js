// src/app/registro/usuario/page.js
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/actions/auth-actions"; // Asegúrate de que esta importación sea correcta
import Link from "next/link";

export default function RegistroUsuarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Estados del formulario
  const [form, setForm] = useState({
    name: "",
    email: "",
    identification: "", // Nota: Estos campos extras se envían, pero el backend debe estar preparado para recibirlos si decides guardarlos.
    birthDate: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gender: "",
    interests: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false); // Para mostrar errores solo cuando el usuario interactúa

  // --- VALIDACIONES DE CONTRASEÑA EN TIEMPO REAL (UX MEJORADA) ---
  const passwordChecks = useMemo(() => {
    const pwd = form.password || "";
    return {
      length: pwd.length >= 8,
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      match: pwd && pwd === form.confirmPassword
    };
  }, [form.password, form.confirmPassword]);

  // La contraseña es válida si CUMPLE TODAS las reglas
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // Manejo de cambios en inputs
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'password' || name === 'confirmPassword') {
        setTouched(true);
    }
  }

  // --- ENVÍO DEL FORMULARIO ---
  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setTouched(true);

    // Validación final en cliente
    if (!isPasswordValid) {
      setErrorMsg("⚠️ La contraseña no cumple con todas las normas de seguridad.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Llamada a la Server Action (que ahora envía el email y genera el token)
      const res = await registerUser(formData);

      if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else {
        // Éxito -> Redirigir a Login con bandera de éxito
        router.push("/ingresar?registered=true");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Ocurrió un error inesperado de conexión.");
      setLoading(false);
    }
  }

  // Fecha máxima (hoy) para el input date
  const maxDate = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-extrabold text-blue-900">
          Crear cuenta de Paciente
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Gestiona tus citas y encuentra profesionales.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-100">
          
            {errorMsg && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
                    <span className="text-red-500 mr-2">⚠️</span>
                    <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
                </div>
            )}

            <form onSubmit={onSubmit} className="space-y-6">
            
            {/* --- DATOS PERSONALES --- */}
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre Completo *</label>
                    <input
                        name="name"
                        type="text"
                        required
                        placeholder="Tu nombre completo"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={form.name}
                        onChange={handleChange}
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Correo Electrónico *</label>
                    <input
                        name="email"
                        type="email"
                        required
                        placeholder="ejemplo@correo.com"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={form.email}
                        onChange={handleChange}
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Identificación</label>
                    <input
                        name="identification"
                        type="text"
                        placeholder="DNI / Cédula"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={form.identification}
                        onChange={handleChange}
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha Nacimiento</label>
                    <input
                        name="birthDate"
                        type="date"
                        max={maxDate}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={form.birthDate}
                        onChange={handleChange}
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
                    <input
                        name="phone"
                        type="tel"
                        placeholder="+54 ..."
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={form.phone}
                        onChange={handleChange}
                    />
                </div>
            </div>

            <hr className="border-gray-200" />

            {/* --- SECCIÓN SEGURIDAD --- */}
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-inner">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Seguridad de la cuenta</h3>
                
                <div className="space-y-4">
                    <div className="relative">
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Contraseña</label>
                        <input
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            value={form.password}
                            onChange={handleChange}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 top-6 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-blue-600 font-medium"
                        >
                            {showPassword ? "Ocultar" : "Ver"}
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Confirmar Contraseña</label>
                        <input
                            name="confirmPassword"
                            type="password"
                            required
                            className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!passwordChecks.match && touched ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                            value={form.confirmPassword}
                            onChange={handleChange}
                        />
                    </div>

                    {/* CHECKLIST VISUAL MEJORADO */}
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <StatusItem valid={passwordChecks.length} label="Mínimo 8 caracteres" />
                        <StatusItem valid={passwordChecks.number} label="Al menos un número" />
                        <StatusItem valid={passwordChecks.special} label="Carácter especial (@$!%*?&)" />
                        <StatusItem valid={passwordChecks.match} label="Las contraseñas coinciden" />
                    </div>
                </div>
            </div>

            {/* --- EXTRAS OPCIONALES --- */}
            <div className="grid grid-cols-1 gap-4 pt-2">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Género (Opcional)</label>
                    <select
                        name="gender"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                        value={form.gender}
                        onChange={handleChange}
                    >
                        <option value="">Seleccionar...</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="No Binario">No Binario</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Intereses / Motivo de consulta (Opcional)</label>
                    <textarea
                        name="interests"
                        rows="2"
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        value={form.interests}
                        onChange={handleChange}
                        placeholder="Ej: Ansiedad, Nutrición, Chequeo general..."
                    />
                </div>
            </div>

            {/* --- BOTÓN SUBMIT --- */}
            <div>
                <button
                    type="submit"
                    disabled={loading || !isPasswordValid}
                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white transition-all transform active:scale-95
                        ${loading || !isPasswordValid 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-900 hover:bg-blue-800 shadow-lg'}`}
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Registrando...
                        </span>
                    ) : (
                        "Registrarme"
                    )}
                </button>
            </div>

            </form>

            <div className="mt-6">
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">¿Ya tienes cuenta?</span>
                    </div>
                </div>
                <div className="mt-6 text-center">
                    <Link href="/ingresar" className="font-bold text-blue-900 hover:text-blue-700">
                        Iniciar Sesión
                    </Link>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}

// Componente helper para items de validación
function StatusItem({ valid, label }) {
    return (
        <div className={`flex items-center gap-2 px-2 py-1 rounded transition-colors ${valid ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${valid ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'}`}>
                {valid ? '✓' : '•'}
            </span>
            <span className="font-medium">{label}</span>
        </div>
    )
}
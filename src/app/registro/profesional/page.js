// src/app/registro/profesional/page.js
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { registerProfessional } from "@/actions/auth-actions";
import Link from "next/link";

export default function RegistroProfesionalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // --- ESTADOS DEL FORMULARIO ---
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    specialty: "",
    licenseNumber: "",
    phone: "",
    bio: "",
  });

  const [file, setFile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false); // Para mostrar errores solo al interactuar

  // --- VALIDACIÓN DE CONTRASEÑA (Visual y Lógica) ---
  const passwordChecks = useMemo(() => {
    const pwd = form.password || "";
    return {
      length: pwd.length >= 8,
      number: /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      match: pwd && pwd === form.confirmPassword && pwd !== ""
    };
  }, [form.password, form.confirmPassword]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  // --- MANEJADORES ---
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'password' || name === 'confirmPassword') setTouched(true);
  }

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.type !== "application/pdf") {
        alert("Solo se permiten archivos PDF.");
        e.target.value = null;
        return;
      }
      if (selected.size > 2 * 1024 * 1024) { // 2MB
        alert("El archivo es muy pesado (Máx 2MB).");
        e.target.value = null;
        return;
      }
      setFile(selected);
    }
  }

  // --- ENVÍO DEL FORMULARIO ---
  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setTouched(true);

    // 1. Validaciones Locales
    if (!isPasswordValid) {
      setErrorMsg("⚠️ La contraseña no cumple con los requisitos de seguridad.");
      return;
    }
    if (!file) {
      setErrorMsg("⚠️ Es obligatorio adjuntar tu Curriculum Vitae (PDF).");
      return;
    }

    setLoading(true);

    try {
      // 2. Subir PDF a Supabase Storage
      // Nombre único: timestamp-nombreusuario-clean.pdf
      const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '');
      const uniqueName = `${Date.now()}-${cleanName}`;

      const { error: uploadError } = await supabase
        .storage
        .from('cvs')
        .upload(uniqueName, file);

      if (uploadError) throw new Error("Error al subir el CV: " + uploadError.message);

      // Obtener URL Pública
      const { data: { publicUrl } } = supabase
        .storage
        .from('cvs')
        .getPublicUrl(uniqueName);

      // 3. Preparar Datos para Server Action
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('cvUrl', publicUrl); // Agregamos la URL del archivo subido

      // 4. Registrar en Base de Datos
      const res = await registerProfessional(formData);

      if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else {
        // Éxito
        router.push("/ingresar?registered=true");
      }

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Ocurrió un error inesperado.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg">
          🩺
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Únete como Profesional
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Únete a la red de salud mental más grande de la región.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          
          {errorMsg && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
                <span className="text-red-500 mr-2">⚠️</span>
                <p className="text-sm text-red-700 font-medium">{errorMsg}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={onSubmit}>
            
            {/* --- SECCIÓN: DATOS DE CUENTA --- */}
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre Completo</label>
                <input
                  name="name" type="text" required placeholder="Dr. Juan Pérez"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={form.name} onChange={handleChange}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Correo Electrónico</label>
                <input
                  name="email" type="email" required placeholder="juan@ejemplo.com"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={form.email} onChange={handleChange}
                />
              </div>
            </div>

            {/* --- SECCIÓN: SEGURIDAD (PASSWORD) --- */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Contraseña</label>
                        <input
                            name="password"
                            type={showPassword ? "text" : "password"}
                            required
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            value={form.password} onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Confirmar</label>
                        <input
                            name="confirmPassword"
                            type="password"
                            required
                            className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${!passwordChecks.match && touched ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                            value={form.confirmPassword} onChange={handleChange}
                        />
                    </div>
                </div>
                
                <div className="mt-2 flex justify-between items-center">
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-xs text-blue-600 font-medium hover:underline">
                        {showPassword ? "Ocultar caracteres" : "Mostrar caracteres"}
                    </button>
                </div>

                {/* CHECKLIST VISUAL */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <StatusItem valid={passwordChecks.length} label="Mín. 8 caracteres" />
                    <StatusItem valid={passwordChecks.number} label="Incluye un número" />
                    <StatusItem valid={passwordChecks.special} label="Carácter especial" />
                    <StatusItem valid={passwordChecks.match} label="Coinciden" />
                </div>
            </div>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500 font-medium">Perfil Profesional</span>
              </div>
            </div>

            {/* --- SECCIÓN: PERFIL PROFESIONAL --- */}
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Especialidad</label>
                <input
                  name="specialty" type="text" required placeholder="Psicología Clínica"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={form.specialty} onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nº Matrícula / Licencia</label>
                <input
                  name="licenseNumber" type="text" required placeholder="MN-12345"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={form.licenseNumber} onChange={handleChange}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono Profesional</label>
                <input
                  name="phone" type="tel" required placeholder="+506 ..."
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  value={form.phone} onChange={handleChange}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Breve Biografía</label>
                <textarea
                  name="bio" rows={3}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Cuéntanos sobre tu experiencia y enfoque..."
                  value={form.bio} onChange={handleChange}
                />
              </div>
            </div>

            {/* --- SECCIÓN: SUBIDA DE CV --- */}
            <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
              <label className="block text-sm font-bold text-blue-900 mb-2">
                Curriculum Vitae (PDF) <span className="text-red-500">*</span>
              </label>
              
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-blue-50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {file ? (
                           <>
                             <p className="text-3xl mb-2">📄</p>
                             <p className="text-sm text-blue-700 font-semibold">{file.name}</p>
                             <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                           </>
                        ) : (
                           <>
                             <svg className="w-8 h-8 mb-4 text-blue-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                                 <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                             </svg>
                             <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Haz clic para subir</span></p>
                             <p className="text-xs text-gray-500">PDF (MÁX. 2MB)</p>
                           </>
                        )}
                    </div>
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                </label>
              </div>
              <p className="mt-2 text-xs text-blue-800 opacity-80 text-center">
                🔒 Tu documentación será revisada manualmente por nuestro equipo de administración.
              </p>
            </div>

            {/* --- BOTÓN DE ENVÍO --- */}
            <div>
              <button
                type="submit"
                disabled={loading || !isPasswordValid || !file}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white transition-all transform active:scale-95
                  ${loading || !isPasswordValid || !file
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 shadow-lg'}`}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Subiendo CV y Registrando...
                  </span>
                ) : (
                  "Completar Registro"
                )}
              </button>
            </div>

          </form>

          <div className="mt-6 text-center">
            <Link href="/ingresar" className="font-medium text-blue-600 hover:text-blue-500">
              ¿Ya tienes cuenta? Iniciar Sesión
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

// Componente visual para checklist
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
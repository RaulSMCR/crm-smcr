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
  const [loadingText, setLoadingText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  // Estados del formulario
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    specialty: "",
    licenseNumber: "",
    bio: "",
    coverLetter: "",
    introVideoUrl: "",
  });

  const [file, setFile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  // --- VALIDACIONES ---
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
    if (name.includes("password")) setTouched(true);
  }

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.type !== "application/pdf") {
        setErrorMsg("⚠️ Solo se permiten archivos PDF.");
        e.target.value = null;
        return;
      }
      // Validación de tamaño (5MB)
      if (selected.size > 5 * 1024 * 1024) { 
        setErrorMsg("⚠️ El archivo es muy pesado (Máx 5MB).");
        e.target.value = null;
        return;
      }
      setFile(selected);
      setErrorMsg(""); 
    }
  }

  // --- ENVÍO ---
  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setTouched(true);

    if (!isPasswordValid) return;
    
    if (!file) {
      setErrorMsg("⚠️ Es obligatorio adjuntar tu Curriculum Vitae (PDF).");
      return;
    }

    setLoading(true);

    try {
      // 1. SUBIDA A SUPABASE (BUCKET 'CVS' EN MAYÚSCULA)
      setLoadingText("Subiendo documentación...");
      
      const cvFile = file;

      const uploadData = new FormData();
      uploadData.append("file", cvFile);
      uploadData.append("userId", crypto.randomUUID()); // ID temporal hasta que se cree el usuario

      const res = await fetch("/api/upload/cv", {
        method: "POST",
        body: uploadData,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Error subiendo CV.");
      const cvUrl = result.url;

      // 2. REGISTRO EN BACKEND
      setLoadingText("Creando perfil...");

      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('cvUrl', cvUrl);

      const res = await registerProfessional(formData);

      if (res?.error) {
        setErrorMsg(res.error);
        setLoading(false);
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/ingresar?role=professional"), 4000);
      }

    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Ocurrió un error inesperado.");
      setLoading(false);
    }
  }

  // --- VISTA DE ÉXITO ---
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg border border-green-100 text-center animate-fade-in">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <span className="text-3xl">🎉</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Solicitud Enviada!</h2>
          <p className="text-slate-600 mb-6 text-sm">
            Hemos recibido tu perfil profesional y tu CV. Tu cuenta entrará en proceso de revisión.
            <br/><br/>
            Te hemos enviado un correo de confirmación. Revisa tu bandeja de entrada.
          </p>
          <Link href="/ingresar" className="block w-full py-3 px-4 bg-blue-900 text-white rounded-lg hover:bg-blue-800 transition font-medium">
            Ir al Inicio de Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        {/* ENCABEZADO */}
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Únete al Equipo Profesional
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Forma parte de la red de salud mental líder en la región.
          </p>
        </div>

        <div className="bg-white shadow-xl shadow-slate-200/60 rounded-2xl border border-slate-100 overflow-hidden">
          
          {errorMsg && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 m-6 mb-0 rounded-r-md">
              <div className="flex">
                <span className="text-red-500 mr-3 text-xl">⚠️</span>
                <p className="text-sm text-red-700 font-medium self-center">{errorMsg}</p>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* COLUMNA IZQUIERDA: DATOS DE CUENTA */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">
                  Credenciales de Acceso
                </h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                  <input
                    name="name" type="text" required placeholder="Ej: Lic. Juan Pérez"
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
                    value={form.name} onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                  <input
                    name="email" type="email" required placeholder="profesional@ejemplo.com"
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
                    value={form.email} onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono Móvil</label>
                  <input
                    name="phone"
                    type="tel"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+506 8888 8888"
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
                    value={form.phone}
                    onChange={handleChange}
                  />
                </div>

                {/* Password Fields */}
                <div className="pt-2">
                    <div className="relative mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                        <div className="relative">
                            <input
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3 pr-10"
                                value={form.password} onChange={handleChange}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-600"
                            >
                                <span className="text-xs font-bold">{showPassword ? "OCULTAR" : "VER"}</span>
                            </button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Contraseña</label>
                        <input
                            name="confirmPassword"
                            type="password"
                            required
                            className={`w-full rounded-lg shadow-sm py-2.5 px-3 transition-colors ${
                                touched && !passwordChecks.match 
                                ? 'border-red-300 bg-red-50 focus:border-red-500' 
                                : 'border-slate-300 focus:border-blue-500'
                            }`}
                            value={form.confirmPassword} onChange={handleChange}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Badge valid={passwordChecks.length} label="8+ Caracteres" />
                        <Badge valid={passwordChecks.number} label="Número" />
                        <Badge valid={passwordChecks.special} label="Símbolo" />
                        <Badge valid={passwordChecks.match} label="Coinciden" />
                    </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: PERFIL PROFESIONAL */}
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 mb-4">
                  Datos Profesionales
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Especialidad</label>
                        <input
                            name="specialty" 
                            type="text" 
                            required 
                            placeholder="Ej: Psicología Clínica"
                            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
                            value={form.specialty} 
                            onChange={handleChange}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nº Licencia / Matrícula</label>
                        <input
                            name="licenseNumber" type="text" required
                            className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
                            value={form.licenseNumber} onChange={handleChange}
                        />
                    </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Biografía Pública</label>
                  <textarea
                    name="bio"
                    rows="3"
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
                    placeholder="Describe tu enfoque y experiencia..."
                    value={form.bio}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Carta de presentación (opcional)</label>
                  <textarea
                    name="coverLetter"
                    rows="3"
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
                    placeholder="Cuéntanos por qué quieres formar parte de la red."
                    value={form.coverLetter}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Video de introducción (URL, opcional)</label>
                  <input
                    name="introVideoUrl"
                    type="url"
                    placeholder="https://..."
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 px-3"
                    value={form.introVideoUrl}
                    onChange={handleChange}
                  />
                </div>

                {/* SECCIÓN UPLOAD */}
                <div className={`transition-all duration-200 border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center
                    ${file ? 'border-green-300 bg-green-50' : 'border-blue-200 bg-blue-50 hover:bg-blue-100 cursor-pointer'}`}>
                    
                    <label className="w-full h-full flex flex-col items-center cursor-pointer">
                        {file ? (
                            <>
                                <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-2xl mb-2 shadow-sm">📄</div>
                                <p className="text-sm font-bold text-green-800 break-all px-4">{file.name}</p>
                                <p className="text-xs text-green-600 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB - Listo para subir</p>
                                <span className="mt-3 text-xs text-green-700 underline cursor-pointer hover:text-green-900">Cambiar archivo</span>
                            </>
                        ) : (
                            <>
                                <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl mb-2 shadow-sm">cloud_upload</div>
                                <p className="text-sm font-bold text-blue-900">Sube tu Curriculum Vitae</p>
                                <p className="text-xs text-blue-600 mt-1">Formato PDF (Máx. 5MB)</p>
                            </>
                        )}
                        <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                    </label>
                </div>
                <p className="text-[10px] text-slate-400 text-center">
                   * Este documento es confidencial y será usado para validar tu credencial.
                </p>

              </div>
            </div>

            {/* FOOTER ACCIONES */}
            <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col items-center">
              <button
                type="submit"
                disabled={loading || !isPasswordValid || !file}
                className={`w-full sm:w-1/2 flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white transition-all
                  ${loading || !isPasswordValid || !file
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none' 
                    : 'bg-blue-900 hover:bg-blue-800 hover:shadow-lg hover:-translate-y-0.5'}`}
              >
                {loading ? (
                    <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {loadingText}
                    </span>
                ) : "Completar Registro Profesional"}
              </button>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                    ¿Ya tienes cuenta? <Link href="/ingresar" className="font-semibold text-blue-900 hover:underline">Iniciar Sesión</Link>
                </p>
              </div>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

// Subcomponente de validación visual
function Badge({ valid, label }) {
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-colors border ${
            valid 
            ? 'bg-green-50 text-green-700 border-green-200' 
            : 'bg-slate-100 text-slate-400 border-slate-200'
        }`}>
            {valid ? '✓' : '•'} {label}
        </span>
    )
}
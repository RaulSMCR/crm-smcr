"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { registerProfessional } from "@/actions/auth-actions";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

function isEmailFormatValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

function Badge({ valid, label }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium transition-colors ${
      valid ? "bg-brand-900/60 text-brand-200" : "bg-white/10 text-neutral-400"
    }`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${valid ? "bg-brand-400" : "bg-neutral-500"}`} />
      {label}
    </span>
  );
}

// ─── Panel izquierdo (hero fijo) ──────────────────────────────────────────────
function HeroPanel() {
  return (
    <div className="relative min-h-[35vh] w-full flex-shrink-0 md:sticky md:top-0 md:h-screen md:w-[38%]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('/images/registro-profesional.webp'), url('/images/profesional-hero.webp')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/45 to-neutral-950/10" />

      <div className="absolute inset-0 flex flex-col justify-between p-8 md:p-10">
        <Link
          href="/registro"
          className="flex w-fit items-center gap-2 text-sm text-neutral-300 transition-colors hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Elegir tipo de cuenta
        </Link>

        <div>
          <p className={`${playfair.className} mb-3 text-base italic text-neutral-300 md:text-lg`}>
            Amplía tu alcance y tu impacto
          </p>
          <h2 className={`${playfair.className} text-2xl font-bold text-white md:text-3xl`}>
            Registro profesional
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Postula tu perfil a la red de salud mental de Costa Rica.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RegistroProfesionalPage() {
  const router = useRouter();
  const [loading, setLoading]     = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [errorMsg, setErrorMsg]   = useState("");
  const [success, setSuccess]     = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
    specialty: "", licenseNumber: "", bio: "", coverLetter: "", introVideoUrl: "",
  });
  const [file, setFile]               = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched]         = useState(false);

  const passwordChecks = useMemo(() => {
    const pwd = form.password || "";
    return {
      length:  pwd.length >= 8,
      number:  /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      match:   pwd && pwd === form.confirmPassword && pwd !== "",
    };
  }, [form.password, form.confirmPassword]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name.includes("password")) setTouched(true);
  }

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      setErrorMsg("Solo se permite CV en formato PDF.");
      e.target.value = null;
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      setErrorMsg("El archivo supera el tamaño máximo de 5 MB.");
      e.target.value = null;
      return;
    }
    setFile(selected);
    setErrorMsg("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setTouched(true);

    if (!String(form.name || "").trim())        { setErrorMsg("Falta el nombre completo."); return; }
    if (!String(form.email || "").trim())       { setErrorMsg("Falta el correo electrónico."); return; }
    if (!isEmailFormatValid(form.email))        { setErrorMsg("El correo no tiene un formato válido."); return; }
    if (!String(form.phone || "").trim())       { setErrorMsg("Falta el teléfono de contacto."); return; }
    if (!String(form.specialty || "").trim())   { setErrorMsg("Falta indicar la especialidad."); return; }
    if (!String(form.licenseNumber || "").trim()) { setErrorMsg("Falta el número de licencia."); return; }
    if (!isPasswordValid)                       { setErrorMsg("Revise los requisitos de contraseña."); return; }
    if (!file)                                  { setErrorMsg("Falta adjuntar el CV en PDF."); return; }

    setLoading(true);
    try {
      setLoadingText("Subiendo documentación…");
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("userId", crypto.randomUUID());

      const res = await fetch("/api/upload/cv", { method: "POST", body: uploadData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "No fue posible subir el CV.");
      const cvUrl = result.url;

      setLoadingText("Creando perfil…");
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      formData.append("cvUrl", cvUrl);

      const registerRes = await registerProfessional(formData);
      if (registerRes?.error) {
        setErrorMsg(registerRes.error);
        setLoading(false);
      } else {
        setSuccessMsg(
          registerRes?.warning || registerRes?.message ||
          "Se recibió el perfil y el CV. El proceso de revisión avanza para resguardar la calidad de atención. Revise su correo para continuar."
        );
        setSuccess(true);
        setTimeout(() => router.push("/ingresar?registered=professional"), 4000);
      }
    } catch (err) {
      setErrorMsg(err.message || "Ocurrió un error inesperado.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all placeholder-neutral-400";

  const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500";

  // ── Vista de éxito ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-appbg px-4">
        <div className="w-full max-w-md rounded-2xl border border-brand-200 bg-white p-10 text-center shadow-card">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
            🎉
          </div>
          <h2 className={`${playfair.className} mb-2 text-2xl font-bold text-neutral-950`}>
            Solicitud recibida
          </h2>
          <p className="mb-6 text-sm text-neutral-600">{successMsg}</p>
          <Link href="/ingresar"
            className="block w-full rounded-xl bg-brand-600 py-3 font-bold text-white transition-colors hover:bg-brand-500">
            Ir al ingreso
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <HeroPanel />

      {/* Formulario */}
      <div className="flex-1 bg-appbg px-6 py-12 md:px-12 md:py-14">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-1 text-2xl font-bold text-neutral-950">Completa tu postulación</h1>
          <p className="mb-8 text-sm text-neutral-600">
            Revisamos cada perfil para garantizar la calidad de atención en SMCR.
          </p>

          {errorMsg && (
            <div className="mb-6 rounded-xl border border-accent-300 bg-accent-50 p-4 text-sm text-accent-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-2">

              {/* Columna izquierda: credenciales */}
              <section className="space-y-4">
                <h2 className="border-b border-neutral-200 pb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                  Credenciales de acceso
                </h2>

                <div>
                  <label className={labelClass}>Nombre completo</label>
                  <input name="name" type="text" required placeholder="Lic. Nombre Apellido"
                    className={inputClass} value={form.name} onChange={handleChange} />
                </div>

                <div>
                  <label className={labelClass}>Correo electrónico</label>
                  <input name="email" type="email" required placeholder="profesional@ejemplo.com"
                    className={inputClass} value={form.email} onChange={handleChange} />
                </div>

                <div>
                  <label className={labelClass}>Teléfono móvil</label>
                  <input name="phone" type="tel" required inputMode="tel" autoComplete="tel"
                    placeholder="+506 8888 8888" className={inputClass}
                    value={form.phone} onChange={handleChange} />
                </div>

                {/* Contraseñas */}
                <div>
                  <label className={labelClass}>Contraseña</label>
                  <div className="relative">
                    <input name="password" type={showPassword ? "text" : "password"} required
                      className={`${inputClass} pr-16`} value={form.password} onChange={handleChange} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-neutral-400 hover:text-neutral-700">
                      {showPassword ? "OCULTAR" : "VER"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Confirmar contraseña</label>
                  <input name="confirmPassword" type="password" required
                    className={`${inputClass} ${touched && !passwordChecks.match ? "border-accent-400 bg-accent-50" : ""}`}
                    value={form.confirmPassword} onChange={handleChange} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge valid={passwordChecks.length}  label="8+ caracteres" />
                  <Badge valid={passwordChecks.number}  label="Número" />
                  <Badge valid={passwordChecks.special} label="Símbolo" />
                  <Badge valid={passwordChecks.match}   label="Coinciden" />
                </div>
              </section>

              {/* Columna derecha: perfil profesional */}
              <section className="space-y-4">
                <h2 className="border-b border-neutral-200 pb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                  Datos profesionales
                </h2>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Especialidad</label>
                    <input name="specialty" type="text" required placeholder="Ej: Psicología Clínica"
                      className={inputClass} value={form.specialty} onChange={handleChange} />
                  </div>
                  <div>
                    <label className={labelClass}>Nº Licencia / Matrícula</label>
                    <input name="licenseNumber" type="text" required
                      className={inputClass} value={form.licenseNumber} onChange={handleChange} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Biografía pública</label>
                  <textarea name="bio" rows={3}
                    placeholder="Describa su enfoque y experiencia…"
                    className={inputClass} value={form.bio} onChange={handleChange} />
                </div>

                <div>
                  <label className={labelClass}>Carta de presentación (opcional)</label>
                  <textarea name="coverLetter" rows={3}
                    placeholder="¿Por qué desea formar parte de la red?"
                    className={inputClass} value={form.coverLetter} onChange={handleChange} />
                </div>

                <div>
                  <label className={labelClass}>Video de introducción (URL, opcional)</label>
                  <input name="introVideoUrl" type="url" placeholder="https://…"
                    className={inputClass} value={form.introVideoUrl} onChange={handleChange} />
                </div>

                {/* Upload CV */}
                <div>
                  <label className={labelClass}>Currículum Vitae (PDF, máx. 5 MB)</label>
                  <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                    file
                      ? "border-brand-300 bg-brand-50"
                      : "border-neutral-300 bg-white hover:border-brand-400 hover:bg-brand-50"
                  }`}>
                    {file ? (
                      <>
                        <span className="mb-1 text-2xl">📄</span>
                        <p className="break-all text-sm font-bold text-brand-800">{file.name}</p>
                        <p className="mt-0.5 text-xs text-brand-600">
                          {(file.size / 1024 / 1024).toFixed(2)} MB · Listo para subir
                        </p>
                        <span className="mt-2 text-xs text-brand-700 underline">Cambiar archivo</span>
                      </>
                    ) : (
                      <>
                        <span className="mb-1 text-2xl text-neutral-400">↑</span>
                        <p className="text-sm font-semibold text-neutral-700">Adjunte su CV</p>
                        <p className="mt-0.5 text-xs text-neutral-400">Solo PDF · Máx. 5 MB</p>
                      </>
                    )}
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
                  </label>
                </div>
              </section>
            </div>

            {/* Submit */}
            <div className="border-t border-neutral-200 pt-6">
              <button
                type="submit"
                disabled={loading || !isPasswordValid || !file}
                className="w-full rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-1/2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {loadingText}
                  </span>
                ) : "Completar registro"}
              </button>

              <p className="mt-6 text-center text-sm text-neutral-500">
                ¿Ya tienes cuenta?{" "}
                <Link href="/ingresar" className="font-medium text-brand-700 hover:text-brand-900">
                  Ingresar
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

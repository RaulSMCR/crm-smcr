"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { registerUser } from "@/actions/auth-actions";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { trackLead } from "@/lib/meta-pixel";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

function isEmailFormatValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

function StatusBadge({ valid, label }) {
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
            "url('/images/registro-paciente.jpg'), url('/images/paciente-hero.webp')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/40 to-neutral-950/10" />

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
            Tu bienestar comienza con un paso
          </p>
          <h2 className={`${playfair.className} text-2xl font-bold text-white md:text-3xl`}>
            Registro de paciente
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Accede a una red de profesionales validados en salud mental.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function RegistroUsuarioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", identification: "", birthDate: "",
    phone: "", password: "", confirmPassword: "", gender: "", interests: "",
  });

  const passwordChecks = useMemo(() => {
    const pwd = form.password || "";
    return {
      length:  pwd.length >= 8,
      number:  /\d/.test(pwd),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
      match:   pwd && pwd === form.confirmPassword,
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

    if (!String(form.name || "").trim())           { setErrorMsg("Falta el nombre completo."); return; }
    if (!String(form.email || "").trim())          { setErrorMsg("Falta el correo electrónico."); return; }
    if (!isEmailFormatValid(form.email))           { setErrorMsg("El correo no tiene un formato válido."); return; }
    if (!String(form.phone || "").trim())          { setErrorMsg("Falta el teléfono de contacto."); return; }
    if (!String(form.identification || "").trim()) { setErrorMsg("Falta la identificación."); return; }
    if (!isPasswordValid)                          { setErrorMsg("Revise los requisitos de contraseña."); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      const res = await registerUser(formData);
      if (res?.error || res?.warning) {
        setErrorMsg(res.error || res.warning);
        setLoading(false);
      } else {
        trackEvent("sign_up", { method: "email" });
        trackLead();
        router.push("/ingresar?registered=true");
      }
    } catch {
      setErrorMsg("Error de conexión. Por favor, intente nuevamente.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all placeholder-neutral-400";

  const labelClass = "mb-1 block text-xs font-semibold uppercase tracking-widest text-neutral-500";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <HeroPanel />

      {/* Formulario */}
      <div className="flex-1 bg-appbg px-6 py-12 md:px-12 md:py-14">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-1 text-2xl font-bold text-neutral-950">Crea tu cuenta</h1>
          <p className="mb-8 text-sm text-neutral-600">
            Completa los datos para acceder a la red de profesionales SMCR.
          </p>

          {errorMsg && (
            <div className="mb-6 rounded-xl border border-accent-300 bg-accent-50 p-4 text-sm text-accent-800">
              {errorMsg}
            </div>
          )}

          <form className="space-y-6" onSubmit={onSubmit}>
            {/* Información personal */}
            <section className="space-y-4">
              <h2 className="border-b border-neutral-200 pb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                Información personal
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Nombre completo</label>
                  <input name="name" type="text" required className={inputClass}
                    value={form.name} onChange={handleChange} />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Correo electrónico</label>
                  <input name="email" type="email" required className={inputClass}
                    placeholder="correo@dominio.com" value={form.email} onChange={handleChange} />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Teléfono</label>
                  <input name="phone" type="tel" required inputMode="tel"
                    placeholder="+506 8888 8888" className={inputClass}
                    value={form.phone} onChange={handleChange} />
                </div>

                <div>
                  <label className={labelClass}>DNI / Cédula</label>
                  <input name="identification" type="text" className={inputClass}
                    value={form.identification} onChange={handleChange} />
                </div>

                <div>
                  <label className={labelClass}>Fecha de nacimiento</label>
                  <input name="birthDate" type="date"
                    max={new Date().toISOString().split("T")[0]}
                    className={inputClass} value={form.birthDate} onChange={handleChange} />
                </div>

                <div>
                  <label className={labelClass}>Género</label>
                  <select name="gender" className={inputClass} value={form.gender} onChange={handleChange}>
                    <option value="">Prefiero no indicar</option>
                    <option value="femenino">Femenino</option>
                    <option value="masculino">Masculino</option>
                    <option value="no_binario">No binario</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass}>Intereses terapéuticos</label>
                  <textarea name="interests" rows={3}
                    placeholder="Ej: manejo de ansiedad, terapia de pareja, autoestima…"
                    className={inputClass} value={form.interests} onChange={handleChange} />
                </div>
              </div>
            </section>

            {/* Seguridad */}
            <section className="space-y-4">
              <h2 className="border-b border-neutral-200 pb-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                Seguridad
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
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
                  <label className={labelClass}>Confirmar</label>
                  <div className="relative">
                    <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} required
                      className={`${inputClass} pr-16 ${touched && !passwordChecks.match ? "border-accent-400 bg-accent-50" : ""}`}
                      value={form.confirmPassword} onChange={handleChange} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-xs font-bold text-neutral-400 hover:text-neutral-700">
                      {showConfirmPassword ? "OCULTAR" : "VER"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusBadge valid={passwordChecks.length}  label="8+ caracteres" />
                <StatusBadge valid={passwordChecks.number}  label="Número" />
                <StatusBadge valid={passwordChecks.special} label="Símbolo" />
                <StatusBadge valid={passwordChecks.match}   label="Coinciden" />
              </div>
            </section>

            <button
              type="submit"
              disabled={loading || !isPasswordValid}
              className="w-full rounded-xl bg-brand-600 px-6 py-3.5 font-bold text-white transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Procesando…" : "Crear cuenta y avanzar"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            ¿Ya tienes cuenta?{" "}
            <Link href="/ingresar" className="font-medium text-brand-700 hover:text-brand-900">
              Ingresar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

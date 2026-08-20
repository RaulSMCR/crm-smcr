"use client";

// Registro de la verificación de colegiatura, en el mismo lugar donde el admin
// revisa a un profesional pendiente.
//
// El momento no es casual: la verificación es parte del tamizaje previo a la
// entrevista, así que el formulario vive junto al CV y al botón de aprobar, y no
// en una pantalla aparte que haya que acordarse de visitar.

import { useState } from "react";
import { registrarVerificacionColegiatura } from "@/actions/admin-actions";

function fechaCorta(valor) {
  if (!valor) return null;
  return new Intl.DateTimeFormat("es-CR", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(valor),
  );
}

export default function VerificacionColegiatura({ perfil }) {
  const yaVerificado = Boolean(perfil?.licenseVerifiedAt);

  const [abierto, setAbierto] = useState(false);
  const [colegio, setColegio] = useState(perfil?.licensingBody || "");
  const [matricula, setMatricula] = useState(perfil?.licenseNumber || "");
  const [url, setUrl] = useState(perfil?.licenseVerificationUrl || "");
  const [estado, setEstado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    setEstado(null);
    const r = await registrarVerificacionColegiatura(perfil.id, {
      licensingBody: colegio,
      licenseNumber: matricula,
      licenseVerificationUrl: url,
    });
    setGuardando(false);
    if (r?.error) return setEstado({ tipo: "error", texto: r.error });
    setEstado({ tipo: "ok", texto: "Verificación registrada." });
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <div className="mt-2">
        {yaVerificado ? (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-xs">
            <div className="font-semibold text-emerald-900">
              Colegiatura verificada · {fechaCorta(perfil.licenseVerifiedAt)}
            </div>
            <div className="text-emerald-800">
              {perfil.licensingBody} · Mat. {perfil.licenseNumber}
            </div>
            {perfil.licenseVerificationUrl ? (
              <a
                href={perfil.licenseVerificationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 underline break-all"
              >
                Ver en el registro del colegio
              </a>
            ) : (
              <div className="text-amber-700">Sin enlace al registro público.</div>
            )}
            <button type="button" onClick={() => setAbierto(true)} className="mt-1 block underline text-emerald-800">
              Actualizar
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs">
            <div className="font-semibold text-amber-900">Colegiatura sin verificar</div>
            <p className="text-amber-800">
              Revisá la matrícula en el registro del colegio antes de la entrevista.
            </p>
            <button type="button" onClick={() => setAbierto(true)} className="mt-1 underline text-amber-900">
              Registrar verificación
            </button>
          </div>
        )}
        {estado ? (
          <div className={`mt-1 text-xs ${estado.tipo === "ok" ? "text-emerald-700" : "text-red-700"}`}>
            {estado.texto}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-slate-300 bg-white p-2 text-xs">
      <label className="block">
        <span className="font-semibold text-slate-700">Colegio profesional</span>
        <input
          value={colegio}
          onChange={(e) => setColegio(e.target.value)}
          placeholder="Colegio de Profesionales en Psicología de Costa Rica"
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="block">
        <span className="font-semibold text-slate-700">Número de matrícula</span>
        <input
          value={matricula}
          onChange={(e) => setMatricula(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
        />
      </label>

      <label className="block">
        <span className="font-semibold text-slate-700">Enlace al registro público</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1"
        />
        <span className="text-[11px] text-slate-500">
          El registro público del colegio. Si el colegio da un enlace directo a la ficha de la
          persona, usá ese; si solo tiene buscador —como el del CPPCR— pegá el buscador y anotá la
          matrícula, que es con lo que se busca.
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded bg-brand-700 px-3 py-1 font-semibold text-white disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="rounded border border-slate-300 px-3 py-1">
          Cancelar
        </button>
      </div>

      {estado ? (
        <div className={estado.tipo === "ok" ? "text-emerald-700" : "text-red-700"}>{estado.texto}</div>
      ) : null}
    </div>
  );
}

"use client";

// Las firmas del profesional para los formularios de seguro. Se guardan varias
// versiones y rotan: cada formulario lleva una distinta, como una firma a mano.
//
// La imagen se prepara en el navegador (ver CapturaDeFirma): al servidor llega
// un PNG transparente listo para estampar (ver /api/pro/firmas).
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { ConElDedo, DesdeFoto, FONDO_TRANSPARENTE } from "@/components/firma/CapturaDeFirma";

const BOTON =
  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

export default function FirmasDelProfesional() {
  const { avisar } = useToast();
  const [versiones, setVersiones] = useState(null);
  const [modo, setModo] = useState(null);
  const [lista, setLista] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [marca, setMarca] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/pro/firmas", { cache: "no-store" });
      const datos = await r.json();
      setVersiones(r.ok ? datos.versiones : []);
      if (!r.ok) avisar(datos.message || "No se pudieron leer sus firmas.", "error");
    } catch {
      setVersiones([]);
      avisar("No se pudieron leer sus firmas.", "error");
    }
  }, [avisar]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const alPreparar = useCallback((lienzo) => setLista(lienzo), []);

  async function guardar() {
    if (!lista) return;
    setGuardando(true);
    try {
      const blob = await new Promise((resolve) => lista.toBlob(resolve, "image/png"));
      const form = new FormData();
      form.append("firma", blob, "firma.png");
      const r = await fetch("/api/pro/firmas", { method: "POST", body: form });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) {
        avisar(datos.message || "No se pudo guardar la firma.", "error");
        return;
      }
      avisar("Firma guardada.", "success");
      setModo(null);
      setLista(null);
      setMarca(Date.now());
      await cargar();
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(version) {
    if (!window.confirm("¿Borrar esta firma? Los formularios ya firmados con ella no cambian.")) return;
    const r = await fetch(`/api/pro/firmas/${version}`, { method: "DELETE" });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) {
      avisar(datos.message || "No se pudo borrar la firma.", "error");
      return;
    }
    avisar("Firma borrada.", "success");
    await cargar();
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-700">
        Se estampan en los formularios de reclamo de seguro de sus pacientes, para que no tenga que imprimir ni escanear.
        Guarde entre 3 y 6 versiones: cada formulario lleva una distinta, como cuando se firma a mano.
      </p>

      {versiones === null ? (
        <p className="text-sm text-neutral-500">Cargando sus firmas…</p>
      ) : versiones.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          Todavía no tiene firmas guardadas.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {versiones.map((v) => (
            <li key={v} className="rounded-xl border border-neutral-200 bg-white p-2">
              <div className="flex h-20 items-center justify-center rounded-lg" style={FONDO_TRANSPARENTE}>
                {/* eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por la API */}
                <img src={`/api/pro/firmas/${v}?m=${marca}`} alt={`Firma ${v}`} className="max-h-16 max-w-full" />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                <span>Versión {v}</span>
                <button type="button" onClick={() => borrar(v)} className="font-semibold text-accent-800 hover:underline">
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modo === null ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setModo("foto")} className={`${BOTON} bg-brand-600 text-white hover:bg-brand-500`}>
            Agregar desde una foto
          </button>
          <button
            type="button"
            onClick={() => setModo("dedo")}
            className={`${BOTON} border border-neutral-300 text-neutral-800 hover:bg-neutral-100`}
          >
            Firmar con el dedo
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
          {modo === "foto" ? <DesdeFoto onLista={alPreparar} /> : <ConElDedo onLista={alPreparar} />}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setModo(null);
                setLista(null);
              }}
              className={`${BOTON} border border-neutral-300 text-neutral-800 hover:bg-neutral-100`}
            >
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={!lista || guardando} className={`${BOTON} bg-brand-600 text-white hover:bg-brand-500`}>
              {guardando ? "Guardando…" : "Guardar firma"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

// Las firmas del profesional para los formularios de seguro. Se guardan varias
// versiones y rotan: cada formulario lleva una distinta, como una firma a mano.
//
// La imagen se prepara en el navegador, sin dependencias: de una foto de la
// firma en papel blanco se quita el fondo (lo claro se vuelve transparente), se
// recorta al trazo y se achica; o se dibuja con el dedo. Al servidor llega un
// PNG transparente listo para estampar (ver /api/pro/firmas).
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

const ANCHO_MAXIMO = 800;
const MARGEN = 12;
const BOTON =
  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";
// Damero claro: deja ver que el fondo de la firma es transparente.
const FONDO_TRANSPARENTE = {
  backgroundImage:
    "linear-gradient(45deg,#eee 25%,transparent 25%),linear-gradient(-45deg,#eee 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eee 75%),linear-gradient(-45deg,transparent 75%,#eee 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
};

/** Recorta el lienzo al trazo (lo no transparente) y lo achica si hace falta. */
function recortarYExportar(origen) {
  const ctx = origen.getContext("2d");
  const { width, height } = origen;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const x0 = Math.max(0, minX - MARGEN);
  const y0 = Math.max(0, minY - MARGEN);
  const w = Math.min(width, maxX + MARGEN + 1) - x0;
  const h = Math.min(height, maxY + MARGEN + 1) - y0;
  const escala = Math.min(1, ANCHO_MAXIMO / w);
  const destino = document.createElement("canvas");
  destino.width = Math.round(w * escala);
  destino.height = Math.round(h * escala);
  destino.getContext("2d").drawImage(origen, x0, y0, w, h, 0, 0, destino.width, destino.height);
  return destino;
}

/**
 * Quita el fondo de una foto: lo más claro que el umbral se vuelve
 * transparente y el trazo queda en tinta oscura uniforme. El umbral sale del
 * brillo medio del papel menos la sensibilidad elegida.
 */
function quitarFondo(imagen, sensibilidad) {
  const escala = Math.min(1, 1600 / imagen.naturalWidth);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.naturalWidth * escala);
  lienzo.height = Math.round(imagen.naturalHeight * escala);
  const ctx = lienzo.getContext("2d");
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  const pixeles = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
  const d = pixeles.data;

  let suma = 0;
  for (let i = 0; i < d.length; i += 4) suma += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const papel = suma / (d.length / 4);
  const umbral = papel - sensibilidad;

  for (let i = 0; i < d.length; i += 4) {
    const luz = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (luz >= umbral) {
      d[i + 3] = 0;
    } else {
      // Tinta azul oscura, más opaca cuanto más oscuro el trazo original.
      d[i] = 20; d[i + 1] = 30; d[i + 2] = 90;
      d[i + 3] = Math.min(255, Math.round(((umbral - luz) / Math.max(1, umbral)) * 255 * 3));
    }
  }
  ctx.putImageData(pixeles, 0, 0);
  return recortarYExportar(lienzo);
}

function DesdeFoto({ onLista }) {
  const [imagen, setImagen] = useState(null);
  const [sensibilidad, setSensibilidad] = useState(60);
  const vista = useRef(null);

  useEffect(() => {
    if (!imagen) return;
    const resultado = quitarFondo(imagen, sensibilidad);
    const destino = vista.current;
    if (!destino) return;
    if (!resultado) {
      destino.width = 1;
      destino.height = 1;
      onLista(null);
      return;
    }
    destino.width = resultado.width;
    destino.height = resultado.height;
    destino.getContext("2d").drawImage(resultado, 0, 0);
    onLista(resultado);
  }, [imagen, sensibilidad, onLista]);

  function elegir(event) {
    const archivo = event.target.files?.[0];
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      setImagen(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-600">
        Firme en una hoja blanca con lapicero oscuro y sáquele una foto de cerca, con buena luz y sin sombras.
      </p>
      <input type="file" accept="image/*" capture="environment" onChange={elegir} className="block w-full text-sm" />
      {imagen ? (
        <>
          <div className="rounded-xl border border-neutral-200 p-2" style={FONDO_TRANSPARENTE}>
            <canvas ref={vista} className="mx-auto block max-h-40 max-w-full" />
          </div>
          <label className="block text-sm text-neutral-700">
            Sensibilidad: si aparecen manchas del papel, bájela; si el trazo sale cortado, súbala.
            <input
              type="range"
              min="20"
              max="120"
              value={sensibilidad}
              onChange={(e) => setSensibilidad(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
        </>
      ) : null}
    </div>
  );
}

function ConElDedo({ onLista }) {
  const lienzo = useRef(null);
  const dibujando = useRef(false);

  useEffect(() => {
    const c = lienzo.current;
    const ctx = c.getContext("2d");
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgb(20,30,90)";
  }, []);

  const punto = (event) => {
    const c = lienzo.current;
    const r = c.getBoundingClientRect();
    return { x: ((event.clientX - r.left) * c.width) / r.width, y: ((event.clientY - r.top) * c.height) / r.height };
  };

  function empezar(event) {
    event.preventDefault();
    lienzo.current.setPointerCapture(event.pointerId);
    dibujando.current = true;
    const { x, y } = punto(event);
    const ctx = lienzo.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function mover(event) {
    if (!dibujando.current) return;
    const { x, y } = punto(event);
    const ctx = lienzo.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    onLista(recortarYExportar(lienzo.current));
  }
  function borrar() {
    const c = lienzo.current;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
    onLista(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-600">Firme con el dedo dentro del recuadro, como en papel.</p>
      <canvas
        ref={lienzo}
        width={900}
        height={360}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        className="w-full touch-none rounded-xl border border-dashed border-neutral-400 bg-white"
      />
      <button type="button" onClick={borrar} className={`${BOTON} border border-neutral-300 text-neutral-800 hover:bg-neutral-100`}>
        Borrar y empezar de nuevo
      </button>
    </div>
  );
}

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

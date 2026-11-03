"use client";

// Captura de una firma como PNG transparente, en el navegador y sin
// dependencias: desde una foto de la firma en papel blanco (se quita el fondo,
// se recorta al trazo y se achica) o hecha con el dedo en la pantalla. La usan
// el profesional para sus firmas y el paciente para firmar su formulario de
// seguro. `onLista` recibe el lienzo listo, o null si no hay trazo.
import { useEffect, useRef, useState } from "react";

const ANCHO_MAXIMO = 800;
const MARGEN = 12;
const BOTON =
  "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";
// Damero claro: deja ver que el fondo de la firma es transparente.
export const FONDO_TRANSPARENTE = {
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

export function DesdeFoto({ onLista, indicacion }) {
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
        {indicacion || "Firme en una hoja blanca con lapicero oscuro y sáquele una foto de cerca, con buena luz y sin sombras."}
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

export function ConElDedo({ onLista }) {
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

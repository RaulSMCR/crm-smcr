"use client";

// Muestra la primera página de un PDF dentro de la página, dibujada en un
// canvas con pdf.js. En Android, Chrome no muestra PDF en un iframe: el enlace
// abría el formulario en otra app (Acrobat) y había que ir y volver para
// revisar la firma. pdf.js se carga del CDN con versión fijada e integridad,
// como el OCR de CobroMovil: no suma dependencias ni peso a las funciones.

import { useEffect, useRef, useState } from "react";

const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_SRI = "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let pdfjs = null;
function cargarPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  pdfjs ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS_URL;
    s.integrity = PDFJS_SRI;
    s.crossOrigin = "anonymous";
    s.async = true;
    s.onload = () => {
      if (!window.pdfjsLib) return reject(new Error("PDFJS_NO_DISPONIBLE"));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { pdfjs = null; reject(new Error("PDFJS_NO_DISPONIBLE")); };
    document.head.appendChild(s);
  });
  return pdfjs;
}

/**
 * @param {string} url  Un PDF del mismo dominio (la ruta del trámite con `ver=1`).
 *   Cambiar la url (p. ej. con la fecha de firma) vuelve a dibujarlo.
 */
export default function VisorPdf({ url, titulo = "Formulario" }) {
  const contenedor = useRef(null);
  const canvas = useRef(null);
  const [estado, setEstado] = useState("cargando");

  useEffect(() => {
    let cancelado = false;
    let tarea = null;
    (async () => {
      setEstado("cargando");
      try {
        const lib = await cargarPdfjs();
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const doc = await lib.getDocument({ data: new Uint8Array(await res.arrayBuffer()) }).promise;
        const pagina = await doc.getPage(1);
        if (cancelado) return;
        // Al ancho de la pantalla y con la densidad del celular, para que la
        // firma se lea nítida al agrandar con los dedos.
        const base = pagina.getViewport({ scale: 1 });
        const escala = (contenedor.current.clientWidth / base.width) * Math.min(window.devicePixelRatio || 1, 3);
        const viewport = pagina.getViewport({ scale: escala });
        const c = canvas.current;
        c.width = Math.floor(viewport.width);
        c.height = Math.floor(viewport.height);
        tarea = pagina.render({ canvasContext: c.getContext("2d"), viewport });
        await tarea.promise;
        if (!cancelado) setEstado("listo");
      } catch {
        if (!cancelado) setEstado("error");
      }
    })();
    return () => { cancelado = true; tarea?.cancel(); };
  }, [url]);

  return <div ref={contenedor} className="w-full">
    {estado === "cargando" && <p role="status" className="text-sm text-slate-500">Cargando {titulo.toLowerCase()}…</p>}
    {estado === "error" && <p role="alert" className="text-sm text-red-700">
      No se pudo mostrar acá. <a href={url} target="_blank" rel="noopener noreferrer" className="underline">Abrirlo aparte</a>.
    </p>}
    <canvas ref={canvas} aria-label={titulo} className={`w-full rounded-lg border border-slate-200 bg-white ${estado === "listo" ? "" : "hidden"}`} />
  </div>;
}

"use client";

import { useState } from "react";

// Fachada de YouTube.
//
// Antes esto montaba el <iframe> de entrada, así que la portada arrastraba el
// reproductor completo, el script de anuncios de DoubleClick y su JS asociado en
// la primera carga, aunque nadie fuera a ver el video. Ahora se muestra la
// miniatura —una imagen— y el iframe se monta al primer clic.
//
// La miniatura se sirve desde i.ytimg.com, que es solo un CDN de imágenes: no
// deja cookies ni ejecuta scripts. `maxresdefault` no existe para todos los
// videos; si falta, se cae a `hqdefault`, que siempre está.
const VIDEO_ID = "v_X_PfXVLYg";
const TITULO = "Guía para el usuario de Salud Mental Costa Rica";

export default function MissionVideo() {
  const [activo, setActivo] = useState(false);
  const [miniatura, setMiniatura] = useState(
    `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`,
  );

  return (
    <section className="neutral-300 py-16">
      <div className="container mx-auto px-6 text-center">
        <h2 className="mb-8 text-3xl font-bold text-brand-600">Guía para el usuario</h2>

        <div className="mx-auto aspect-video max-w-2xl overflow-hidden rounded-lg shadow-xl">
          {activo ? (
            <iframe
              // autoplay porque el clic en la fachada ya es la intención de ver.
              src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1`}
              title={TITULO}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            ></iframe>
          ) : (
            <button
              type="button"
              onClick={() => setActivo(true)}
              aria-label={`Reproducir el video: ${TITULO}`}
              className="group relative h-full w-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {/* <img> y no next/image a propósito: la miniatura vive en un dominio
                  externo y pasar por el optimizador agregaría una petición y un
                  dominio remoto en la configuración, para una imagen que ya
                  llega servida y comprimida. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={miniatura}
                alt=""
                width={1280}
                height={720}
                loading="lazy"
                onError={() =>
                  setMiniatura(`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`)
                }
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/40">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                  <svg
                    aria-hidden="true"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="ml-1 text-brand-700"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// Video de presentación de la home.
//
// Antes esto embebía un iframe de YouTube y lo montaba de entrada, así que la
// portada arrastraba el reproductor completo, el script de anuncios y su JS en
// la primera carga aunque nadie fuera a ver el video. Ahora el archivo es propio
// y se sirve desde el mismo dominio: sin terceros, sin cookies ajenas y sin
// nada que declarar en la política de cookies por este bloque.
//
// `preload="none"` es lo que conserva el beneficio de aquella fachada: el
// navegador descarga el póster —50 KB— y no toca los 6 MB del video hasta que
// alguien pulsa reproducir.
const VIDEO_SRC = "/videos/smcr-presentacion.mp4";
const POSTER_SRC = "/videos/smcr-presentacion-poster.jpg";
const TITULO = "Guía para el usuario de Salud Mental Costa Rica";

export default function MissionVideo() {
  return (
    <section className="neutral-300 py-16">
      <div className="container mx-auto px-6 text-center">
        <h2 className="mb-8 text-3xl font-bold text-brand-600">Guía para el usuario</h2>

        <div className="mx-auto aspect-video max-w-2xl overflow-hidden rounded-lg shadow-xl">
          <video
            className="h-full w-full bg-black"
            src={VIDEO_SRC}
            poster={POSTER_SRC}
            controls
            preload="none"
            playsInline
            // Sin `autoPlay`: el video tiene audio, y reproducir sonido sin que
            // nadie lo haya pedido es intrusivo además de estar bloqueado por
            // los navegadores.
            title={TITULO}
          >
            {/* Texto para quien no pueda reproducirlo: navegador antiguo, o un
                lector de pantalla que no encuentre controles. */}
            <p className="p-4 text-sm text-neutral-200">
              Tu navegador no puede reproducir este video.{" "}
              <a href={VIDEO_SRC} className="underline" download>
                Descargalo acá
              </a>
              .
            </p>
          </video>
        </div>
      </div>
    </section>
  );
}

export default function MissionVideo() {
  const videoUrl = "https://www.youtube.com/embed/v_X_PfXVLYg";

  return (
    <section className="neutral-300 py-16">
      <div className="container mx-auto px-6 text-center">
        <h2 className="mb-8 text-3xl font-bold text-brand-600">
          Guía para el usuario
        </h2>
        <div className="mx-auto aspect-video max-w-2xl overflow-hidden rounded-lg shadow-xl">
          <iframe
            src={videoUrl}
            title="Guía para el usuario de Salud Mental Costa Rica"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          ></iframe>
        </div>
      </div>
    </section>
  );
}

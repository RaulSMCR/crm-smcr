// src/components/MissionVideo.js
export default function MissionVideo() {
  // Reemplaza este enlace con el enlace "embed" de tu video de YouTube
  const videoUrl = "https://www.youtube.com/embed/dQw4w9WgXcQ"; 

  return (
    <section className="bg-white py-16"> {/* Menos espaciado vertical */}
      <div className="container mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold text-brand-text mb-8">
          Nuestra Misión y Cómo Usar la Plataforma
        </h2>
        {/* max-w-2xl hace el video más pequeño */}
        <div className="aspect-video max-w-2xl mx-auto rounded-lg shadow-xl overflow-hidden">
          <iframe 
            src={videoUrl} 
            title="Misión de Salud Mental Costa Rica" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowFullScreen
            className="w-full h-full"
          ></iframe>
        </div>
      </div>
    </section>
  );
}
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

// --- UTILIDAD: Convertir Link de YouTube a Embed ---
function getYoutubeEmbedId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --- METADATA DINÁMICA ---
export async function generateMetadata({ params }) {
  const { id } = await params;
  const pro = await prisma.professional.findUnique({
    where: { id },
    select: { name: true, declaredJobTitle: true, bio: true }
  });

  if (!pro) return { title: 'Profesional no encontrado' };

  return {
    title: `${pro.name} - ${pro.declaredJobTitle} | SMCR`,
    description: pro.bio?.substring(0, 160) || `Perfil profesional de ${pro.name}`,
  };
}

// --- COMPONENTE PRINCIPAL ---
export default async function ProfessionalProfilePage({ params }) {
  const { id } = await params;

  // 1. CONSULTA DE DATOS COMPLETA
  const pro = await prisma.professional.findUnique({
    where: { 
      id,
      isApproved: true // ¡Seguridad! Solo mostrar si está aprobado
    },
    include: {
      // Traemos las categorías oficiales (verificadas por ti)
      categories: true,
      // Servicios que ofrece
      services: { select: { title: true, slug: true } },
      // Sus artículos de blog publicados
      posts: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 3, // Mostramos los últimos 3
      }
    }
  });

  if (!pro) return notFound();

  // Preparar Video
  const youtubeId = getYoutubeEmbedId(pro.introVideoUrl);

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      
      {/* --- HEADER / PORTADA --- */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            
            {/* Avatar Grande */}
            <div className="relative w-32 h-32 md:w-48 md:h-48 flex-shrink-0">
              {pro.avatarUrl ? (
                <Image 
                  src={pro.avatarUrl} 
                  alt={pro.name} 
                  fill 
                  className="object-cover rounded-2xl shadow-lg border-4 border-white"
                  priority
                />
              ) : (
                <div className="w-full h-full bg-brand-100 rounded-2xl flex items-center justify-center text-5xl font-bold text-brand-600 shadow-inner">
                  {pro.name.charAt(0)}
                </div>
              )}
              {/* Badge Verificado */}
              <div className="absolute -bottom-3 -right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow border-2 border-white flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Verificado
              </div>
            </div>

            {/* Info Principal */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">{pro.name}</h1>
                <p className="text-xl text-brand-600 font-medium">{pro.declaredJobTitle}</p>
              </div>

              {/* Categorías (Etiquetas) */}
              {pro.categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pro.categories.map(cat => (
                    <span key={cat.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {cat.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Servicios Resumen */}
              <div className="text-sm text-gray-500 pt-2">
                <span className="font-semibold text-gray-700">Ofrece: </span>
                {pro.services.map(s => s.title).join(', ') || "Consultas generales"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA (Bio y Video) - Ocupa 2/3 */}
        <div className="lg:col-span-2 space-y-10">
          
          {/* Sección: Sobre Mí */}
          <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sobre mí</h2>
            <div className="prose prose-blue text-gray-600 leading-relaxed whitespace-pre-wrap">
              {pro.bio || "Este profesional aún no ha agregado una biografía detallada."}
            </div>
          </section>

          {/* Sección: Video Presentación */}
          {youtubeId && (
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Video de Presentación</h2>
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black">
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={`https://www.youtube.com/embed/${youtubeId}`} 
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>
            </section>
          )}

          {/* Sección: Publicaciones del Blog */}
          {pro.posts.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>📝</span> Publicaciones recientes
              </h2>
              <div className="grid gap-6">
                {pro.posts.map((post) => (
                  <Link 
                    key={post.id} 
                    href={`/blog/${post.slug}`}
                    className="group bg-white p-5 rounded-xl border border-gray-200 hover:shadow-md transition-all flex gap-4 items-center"
                  >
                    {post.imageUrl && (
                      <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        <Image src={post.imageUrl} alt={post.title} fill className="object-cover" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">Leer artículo completo →</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* COLUMNA DERECHA (Sticky Sidebar - Call to Action) - Ocupa 1/3 */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            
            {/* Tarjeta de Reserva */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-brand-100 text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Agenda tu sesión</h3>
              <p className="text-sm text-gray-500 mb-6">Reserva directamente en el calendario del profesional.</p>
              
              {pro.calendarUrl ? (
                <a 
                  href={pro.calendarUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block w-full bg-brand-600 text-white font-bold py-4 rounded-xl hover:bg-brand-700 transition-transform transform hover:-translate-y-1 shadow-md"
                >
                  Reservar Ahora
                </a>
              ) : (
                <button disabled className="block w-full bg-gray-200 text-gray-400 font-bold py-4 rounded-xl cursor-not-allowed">
                  Agenda no disponible
                </button>
              )}

              <p className="text-xs text-gray-400 mt-4 flex justify-center items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Reserva segura y confidencial
              </p>
            </div>

            {/* Tarjeta de CV / Info Adicional */}
            {pro.resumeUrl && (
              <div className="bg-white p-5 rounded-xl border border-gray-200">
                <h4 className="font-semibold text-sm text-gray-900 mb-3">Credenciales</h4>
                <a 
                  href={pro.resumeUrl}
                  target="_blank"
                  className="flex items-center gap-3 text-sm text-gray-600 hover:text-brand-600 transition-colors p-2 hover:bg-gray-50 rounded-lg"
                >
                  <span className="bg-red-100 text-red-600 p-2 rounded">PDF</span>
                  Ver Curriculum Vitae
                </a>
              </div>
            )}

          </div>
        </div>

      </main>
    </div>
  );
}
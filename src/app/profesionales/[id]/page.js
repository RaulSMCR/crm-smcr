//src/app/profesionales/[id]/page.js
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ProtectedAction from '@/components/auth/ProtectedAction';

function getYoutubeEmbedId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default async function ProfessionalProfilePage({ params }) {
  const { id } = await params;

  const pro = await prisma.professional.findUnique({
    where: { id, isApproved: true },
    include: {
      categories: true,
      services: { select: { id: true, title: true, price: true } },
      posts: {
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }
    }
  });

  if (!pro) return notFound();
  const youtubeId = getYoutubeEmbedId(pro.introVideoUrl);

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-8 items-start">
          <div className="relative w-32 h-32 md:w-48 md:h-48 flex-shrink-0">
            {pro.avatarUrl ? (
              <Image src={pro.avatarUrl} alt={pro.name} fill className="object-cover rounded-2xl shadow-lg" />
            ) : (
              <div className="w-full h-full bg-blue-100 rounded-2xl flex items-center justify-center text-4xl font-bold text-blue-600">
                {pro.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">{pro.name}</h1>
            <p className="text-xl text-blue-600 font-medium">{pro.declaredJobTitle}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {pro.categories.map(cat => (
                <span key={cat.id} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{cat.name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          <section className="bg-white p-8 rounded-2xl shadow-sm border">
            <h2 className="text-2xl font-bold mb-4">Sobre mí</h2>
            <div className="text-gray-600 leading-relaxed whitespace-pre-wrap">{pro.bio}</div>
          </section>

          {pro.posts.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold mb-6">📝 Publicaciones Recientes</h2>
              <div className="grid gap-4">
                {pro.posts.map((post) => (
                  <ProtectedAction key={post.id}>
                    <Link href={`/blog/${post.slug}`} className="group bg-white p-5 rounded-xl border hover:shadow-md transition-all flex items-center justify-between">
                      <div>
                        <h3 className="font-bold group-hover:text-blue-600">{post.title}</h3>
                        <p className="text-sm text-blue-500 mt-1">🔓 Acceso exclusivo para usuarios</p>
                      </div>
                      <span className="text-gray-400">→</span>
                    </Link>
                  </ProtectedAction>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-8 bg-white p-6 rounded-2xl shadow-lg border border-blue-50">
            <h3 className="text-lg font-semibold mb-4 text-center">Reserva tu cita</h3>
            <ProtectedAction>
              <Link 
                href={`/reservar/${pro.id}`}
                className="block w-full bg-blue-600 text-white text-center font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-md"
              >
                Ver Agenda y Reservar
              </Link>
            </ProtectedAction>
            <p className="text-xs text-gray-400 mt-4 text-center italic">Requiere inicio de sesión</p>
          </div>
        </div>
      </main>
    </div>
  );
}
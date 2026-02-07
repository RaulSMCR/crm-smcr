// src/app/panel/admin/blog/page.js
import { prisma } from "@/lib/prisma";
import { updatePostStatus } from "@/actions/admin-actions";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
        author: { include: { user: true } }
    }
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800">Gestión Editorial</h1>
        <p className="text-slate-500">Revisa y aprueba los artículos de los profesionales.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Título</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Autor</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Fecha</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase">Estado</th>
                    <th className="p-4 text-right text-xs font-bold text-slate-500 uppercase">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {posts.map(post => {
                    // LÓGICA CORREGIDA: Usamos status === 'PUBLISHED'
                    const isPublished = post.status === 'PUBLISHED';
                    
                    return (
                        <tr key={post.id} className="hover:bg-slate-50 transition">
                            <td className="p-4">
                                <Link href={`/blog/${post.slug}`} target="_blank" className="font-bold text-blue-600 hover:underline">
                                    {post.title}
                                </Link>
                            </td>
                            <td className="p-4 text-sm text-slate-600">
                                {post.author?.user?.name || "Desconocido"}
                            </td>
                            <td className="p-4 text-sm text-slate-500">
                                {new Date(post.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${isPublished ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                    {isPublished ? 'PUBLICADO' : 'BORRADOR'}
                                </span>
                            </td>
                            <td className="p-4 text-right">
                                <form action={async () => {
                                    'use server';
                                    // Enviamos el string del Enum contrario
                                    await updatePostStatus(post.id, isPublished ? 'DRAFT' : 'PUBLISHED');
                                }}>
                                    <button className={`px-3 py-1 rounded text-xs font-bold text-white transition ${isPublished ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}>
                                        {isPublished ? 'Despublicar' : 'Aprobar'}
                                    </button>
                                </form>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        {posts.length === 0 && <p className="p-8 text-center text-slate-400">No hay artículos escritos.</p>}
      </div>
    </div>
  );
}
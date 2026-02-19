// src/app/panel/admin/blog/page.js
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { updatePostStatus } from "@/actions/admin-actions";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage({ searchParams }) {
  const authorId = typeof searchParams?.authorId === "string" ? searchParams.authorId : null;

  const where = authorId ? { authorId } : undefined;

  const [posts, author] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { author: { include: { user: true } } },
    }),
    authorId
      ? prisma.professionalProfile.findUnique({
          where: { id: authorId },
          include: { user: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-800">Gestión Editorial</h1>
        <p className="text-slate-500">Revisa y aprueba los artículos de los profesionales.</p>

        {authorId && (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-sm text-slate-700">
              Filtrando por profesional:{" "}
              <span className="font-semibold">
                {author?.user?.name || "Desconocido"}
              </span>
            </div>
            <Link
              href="/panel/admin/blog"
              className="text-sm font-semibold text-blue-700 hover:underline"
            >
              Quitar filtro
            </Link>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="p-4">Título</th>
              <th className="p-4">Autor</th>
              <th className="p-4">Fecha</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {posts.map((post) => {
              const isPublished = post.status === "PUBLISHED";

              return (
                <tr key={post.id} className="hover:bg-slate-50">
                  <td className="p-4 font-semibold text-slate-800">{post.title}</td>
                  <td className="p-4 text-slate-700">
                    {post.author?.user?.name || "Desconocido"}
                  </td>
                  <td className="p-4 text-slate-700">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <span
                      className={[
                        "inline-flex px-2 py-1 rounded-full text-xs font-semibold",
                        isPublished
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-800",
                      ].join(" ")}
                    >
                      {isPublished ? "PUBLICADO" : "BORRADOR"}
                    </span>
                  </td>
                  <td className="p-4">
                    <form
                      action={async () => {
                        "use server";
                        await updatePostStatus(post.id, isPublished ? "DRAFT" : "PUBLISHED");
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm font-semibold text-slate-900 hover:underline"
                      >
                        {isPublished ? "Despublicar" : "Aprobar"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}

            {posts.length === 0 && (
              <tr>
                <td className="p-6 text-slate-500" colSpan={5}>
                  No hay artículos para este criterio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

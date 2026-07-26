import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import AdminPostCreator from "@/components/admin/AdminPostCreator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminBlogNewPage({ searchParams }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const sp = await searchParams;
  const requestedAuthorId = typeof sp?.authorId === "string" ? sp.authorId : "";

  const profiles = await prisma.professionalProfile.findMany({
    orderBy: [{ isApproved: "desc" }, { user: { name: "asc" } }],
    select: {
      id: true,
      specialty: true,
      isApproved: true,
      user: { select: { name: true, email: true } },
    },
  });

  const authors = profiles.map((profile) => ({
    id: profile.id,
    name: profile.user?.name || profile.user?.email || "Sin nombre",
    specialty: profile.specialty || "",
    isApproved: profile.isApproved,
  }));

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <Link href="/panel/admin/blog" className="text-sm font-semibold text-slate-600 hover:text-slate-800">
          ← Gestión editorial
        </Link>

        {authors.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            No hay profesionales registrados todavía. Todo artículo se publica firmado por un profesional, así que
            primero registrá uno en{" "}
            <Link href="/panel/admin/personal" className="font-semibold underline">
              Personal
            </Link>
            .
          </div>
        ) : (
          <AdminPostCreator authors={authors} defaultAuthorId={requestedAuthorId} />
        )}
      </div>
    </main>
  );
}

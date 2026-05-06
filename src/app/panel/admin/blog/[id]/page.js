import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/actions/auth-actions";
import AdminPostEditor from "@/components/admin/AdminPostEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminBlogEditPage({ params }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const post = await prisma.post.findUnique({
    where: { id: String(params?.id || "") },
    include: { author: { include: { user: true } } },
  });

  if (!post) notFound();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <AdminPostEditor post={post} />
      </div>
    </main>
  );
}

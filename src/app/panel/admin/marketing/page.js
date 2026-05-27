import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";
import HomeCarouselManager from "@/components/admin/HomeCarouselManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMarketingPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/ingresar");

  const [items, posts, professionals] = await Promise.all([
    prisma.homeCarouselItem.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      include: {
        post: {
          select: {
            id: true,
            title: true,
            author: { select: { user: { select: { name: true } } } },
          },
        },
        professional: {
          select: {
            id: true,
            specialty: true,
            user: { select: { name: true } },
          },
        },
      },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        author: { select: { user: { select: { name: true } } } },
      },
    }),
    prisma.professionalProfile.findMany({
      where: {
        isApproved: true,
        user: { is: { isActive: true } },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        specialty: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const carouselItems = items.map((item) => ({
    id: item.id,
    kind: item.kind,
    label: item.label || "",
    isActive: item.isActive,
    displayOrder: item.displayOrder,
    postId: item.postId || "",
    professionalId: item.professionalId || "",
    targetName:
      item.post?.title ||
      item.professional?.user?.name ||
      "Referencia no disponible",
  }));

  const postOptions = posts.map((post) => ({
    id: post.id,
    title: post.title,
    authorName: post.author?.user?.name || "Redaccion",
  }));

  const professionalOptions = professionals.map((professional) => ({
    id: professional.id,
    name: professional.user?.name || "Profesional",
    specialty: professional.specialty || "Especialidad sin definir",
  }));

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link href="/panel/admin" className="text-sm text-neutral-500 hover:text-neutral-700">
            Panel
          </Link>
          <h1 className="text-3xl font-bold text-brand-900">Marketing</h1>
          <p className="text-sm text-neutral-700">
            Control de piezas visibles en la pagina principal.
          </p>
        </div>

        <HomeCarouselManager
          initialItems={carouselItems}
          posts={postOptions}
          professionals={professionalOptions}
        />
      </div>
    </div>
  );
}

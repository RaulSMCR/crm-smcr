import { prisma } from "@/lib/prisma";

const ADMIN_HUB_INCLUDE = {
  professional: {
    select: {
      id: true,
      slug: true,
      user: { select: { name: true, isActive: true } },
    },
  },
  modules: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
};

export async function listProfessionalHubsForAdmin() {
  return prisma.professionalHub.findMany({
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      professional: { select: { slug: true, user: { select: { name: true, isActive: true } } } },
      _count: { select: { modules: true } },
    },
  });
}

export async function getProfessionalHubForAdmin(id) {
  return prisma.professionalHub.findUnique({ where: { id: String(id || "") }, include: ADMIN_HUB_INCLUDE });
}

export async function listProfessionalHubOptions() {
  return prisma.professionalProfile.findMany({
    where: { user: { is: { isActive: true } } },
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, user: { select: { name: true } } },
  });
}

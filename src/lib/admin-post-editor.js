import { prisma } from "@/lib/prisma";

/** Contrato de datos del editor cliente: no cargar el perfil ni la cuenta completos. */
export function getAdminPostForEditor(id) {
  return prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      coverImageTitle: true,
      coverImageAlt: true,
      coverImageAuthor: true,
      coverImageNote: true,
      coverImageFocusX: true,
      coverImageFocusY: true,
      coverImageScale: true,
      metaTitle: true,
      metaDescription: true,
      ogImage: true,
      focusKeyword: true,
      noindex: true,
      extractiveBlock: true,
      status: true,
      author: { select: { user: { select: { name: true } } } },
    },
  });
}

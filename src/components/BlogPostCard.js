// src/components/BlogPostCard.js
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { IMAGE_FALLBACKS } from "@/lib/images";

export default function BlogPostCard({ post }) {
  const {
    slug,
    title,
    imageUrl,
    content,
    postType = "TEXT",
    createdAt,
    author,
  } = post || {};

  const cover = imageUrl || IMAGE_FALLBACKS.article;

  return (
    <article className="overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/9]">
        <SafeImage
          src={cover}
          alt={title || "Articulo"}
          fallbackSrc={IMAGE_FALLBACKS.article}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {postType ? <span className="uppercase tracking-wide">{postType}</span> : null}
          {createdAt ? <span>- {new Date(createdAt).toLocaleDateString()}</span> : null}
        </div>

        <h3 className="mt-1 line-clamp-2 text-lg font-semibold">{title}</h3>
        {author?.name ? <p className="text-sm text-gray-600">por {author.name}</p> : null}

        {content ? <p className="mt-2 line-clamp-3 text-sm text-gray-600">{content}</p> : null}

        <div className="mt-3">
          <Link
            href={slug ? `/blog/${encodeURIComponent(slug)}` : "#"}
            className="text-sm text-blue-600 hover:underline"
          >
            Leer mas
          </Link>
        </div>
      </div>
    </article>
  );
}

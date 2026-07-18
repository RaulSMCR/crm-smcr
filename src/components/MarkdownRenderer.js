// src/components/MarkdownRenderer.js
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import SafeImage from "@/components/SafeImage";
import { IMAGE_FALLBACKS } from "@/lib/images";

const MarkdownImage = ({ src, alt }) => {
  if (!src) return null;

  return (
    <span className="relative my-8 block h-[300px] w-full overflow-hidden rounded-lg bg-gray-100 shadow-sm md:h-[450px]">
      <SafeImage
        src={src}
        alt={alt || "Imagen del articulo"}
        fallbackSrc={IMAGE_FALLBACKS.article}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-in-out hover:scale-105"
      />
    </span>
  );
};

const MarkdownLink = ({ href, children }) => {
  const isExternal = href?.startsWith("http");

  return (
    <a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className="font-medium text-brand-600 transition-colors hover:text-brand-800 hover:underline"
    >
      {children}
    </a>
  );
};

export default function MarkdownRenderer({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        img: MarkdownImage,
        a: MarkdownLink,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

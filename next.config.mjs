const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      ...(supabaseHost
        ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
    ],
  },
  // IMPORTANTE: NO usar output: "export" si tenes /api y cookies
  // output: "export",

  // La guia editorial (SKILL.md) se lee en runtime como system prompt de la
  // redaccion asistida; forzamos su inclusion en el bundle de la route.
  outputFileTracingIncludes: {
    "/api/admin/carousels/draft": [
      "./vendor/instagram-slides/SKILL.md",
      "./vendor/smcr-editorial/voz-marca.md",
    ],
  },
};

export default nextConfig;

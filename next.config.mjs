// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Permite cargar imágenes remotas (Unsplash y otras comunes)
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'cdn.pixabay.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
    ],
  },
};

export default nextConfig;

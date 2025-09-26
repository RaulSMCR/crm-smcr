/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config, like images, goes here
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};
export default nextConfig;
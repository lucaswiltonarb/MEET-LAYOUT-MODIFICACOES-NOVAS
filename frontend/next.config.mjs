/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'cdn.tailgrids.com' },
      { hostname: 'gstatic.com' },
      { hostname: 'www.gstatic.com' },
      { hostname: 'img.clerk.com' },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

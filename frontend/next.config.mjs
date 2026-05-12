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
  // Hide Next.js dev indicators / error issue button at the bottom of the page
  devIndicators: false,
};

export default nextConfig;

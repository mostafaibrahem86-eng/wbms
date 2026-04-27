import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here — no "output: standalone" for Vercel */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

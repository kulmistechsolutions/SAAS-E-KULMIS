import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for small Docker images (Coolify/VPS deploys).
  output: "standalone",
  // Consume the shared workspace package's TS source directly.
  transpilePackages: ["@ekulmis/shared"],
  experimental: {
    // Type-safe env / server actions defaults are fine; extend as needed.
  },
};

export default nextConfig;

import type { NextConfig } from "next";

// Cache Components is off on purpose: almost every screen is per-user and
// per-organization, so classic dynamic rendering keeps phase 0 simple.
// Revisit once there are public or shared pages worth caching.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

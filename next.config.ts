import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Tests use their own build directory so they never collide with a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
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

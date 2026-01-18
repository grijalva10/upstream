import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Point to monorepo root where node_modules is hoisted
    root: path.resolve(__dirname, "../.."),
  },
};

export default nextConfig;

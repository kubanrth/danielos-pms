import type { NextConfig } from "next";
import path from "node:path";
import bundleAnalyzer from "@next/bundle-analyzer";

// Bundle analyzer: `ANALYZE=true npm run build` opens a treemap report
// in the browser for each compiled route + chunk. Off by default so
// normal builds stay fast.
const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

export default withAnalyzer(nextConfig);

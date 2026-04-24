import type { MetadataRoute } from "next";

// Belt-and-suspenders: we already set <meta name="robots"> in the root
// layout and an X-Robots-Tag header in next.config.ts, but a real
// /robots.txt is what most crawlers check first.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}

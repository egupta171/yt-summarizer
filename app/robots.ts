// app/robots.ts
import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://yt-summary.vedyugdaily.com";
  return { rules: { userAgent: "*", allow: "/" }, sitemap: `${site}/sitemap.xml`, host: site };
}

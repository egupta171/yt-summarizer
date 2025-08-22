// app/sitemap.ts
import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://yt-summary.vedyugdaily.com";
  const lastMod = new Date();
  return [{ url: `${site}/`, lastModified: lastMod, changeFrequency: "weekly", priority: 1 }];
}

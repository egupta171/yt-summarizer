// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://yt-summary.vedyugdaily.com";
const TITLE = "Vedyug AI – Turn any YouTube video into actionable notes";
const DESCRIPTION =
  "Paste a link. Get a beautiful, skimmable summary with takeaways, timestamps, and action items. 10 free credits on sign-up.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s · YT Summarizer" },
  description: DESCRIPTION,
  applicationName: "YT Summarizer",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "YT Summarizer",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/twitter-image"],
    creator: "@vedyugdaily",
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }, { url: "/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

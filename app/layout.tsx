// app/layout.tsx
import "./globals.css"; // ✅ This was missing
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = { title: "YT Summarizer", description: "Summarize any YouTube video" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en" className="h-full">
        <body className={`${inter.className} min-h-dvh bg-[#0b0f14] text-ink antialiased`}>
          {/* background glow */}
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(60%_35%_at_20%_0%,#17202d_0%,transparent_60%),radial-gradient(50%_40%_at_100%_10%,#1b2a3d_0%,transparent_55%)]" />
          {children}
        </body>
      </html>
    );
  }
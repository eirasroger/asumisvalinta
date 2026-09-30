import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { PageAnalytics } from "@/components/PageAnalytics";
import "./globals.css";

const schibsted = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });

export const metadata: Metadata = {
  title: "Asumisvalinta",
  description: "Compare renting, right of occupancy and buying a flat in Finland with your own numbers.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={schibsted.variable}>
      <body className="min-h-dvh antialiased">
        <header className="sticky top-0 z-40 border-b border-line bg-paper">
          <div className="flex h-14 items-center gap-6 px-4 sm:gap-8 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M3 17V8.5L10 3l7 5.5V17" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinejoin="round" />
                <path d="M7.5 17v-5h5v5" fill="var(--series-buy)" />
              </svg>
              <span className="max-sm:sr-only">Asumisvalinta</span>
            </Link>
            <Nav />
          </div>
        </header>
        {children}
        <PageAnalytics />
        <Footer dataDocs={existsSync(path.join(process.cwd(), "public", "data-docs", "index.html"))} />
      </body>
    </html>
  );
}

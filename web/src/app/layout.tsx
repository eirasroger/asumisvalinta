import { existsSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LogoMark } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { PageAnalytics } from "@/components/PageAnalytics";
import "./globals.css";

const schibsted = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });

const DESCRIPTION = "Rent, right of occupancy or buy? Compare all three for any flat in Finland.";

export const metadata: Metadata = {
  title: "Asumisvalinta",
  description: DESCRIPTION,
  openGraph: { title: "Asumisvalinta", description: DESCRIPTION, siteName: "Asumisvalinta", type: "website", locale: "en" },
  twitter: { card: "summary_large_image", title: "Asumisvalinta", description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={schibsted.variable}>
      <body className="min-h-dvh antialiased">
        <header className="sticky top-0 z-40 border-b border-line bg-paper">
          <div className="flex h-14 items-center gap-6 px-4 sm:gap-8 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
              <LogoMark size={24} className="-ml-0.5" />
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

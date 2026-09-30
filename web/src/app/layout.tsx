import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asumisvalinta",
  description:
    "Rent, right of occupancy or buy a flat in Finland? Compare the options with official data.",
};

const links = [
  { href: "/", label: "Compare" },
  { href: "/market", label: "Market" },
  { href: "/ask", label: "Ask" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
            <Link href="/" className="mr-auto text-lg font-semibold">
              Asumisvalinta
            </Link>
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-ink-secondary hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-6 text-xs text-ink-muted">
            <p>
              Estimates for comparing options under stated assumptions. This is not financial
              advice.
            </p>
            <p>
              Source: Statistics Finland (licence CC BY 4.0), ECB statistics, Finnish Tax
              Administration, Finlex, Financial Supervisory Authority and Asuntosäätiö listings.{" "}
              <Link href="/methodology" className="underline">
                Methodology and sources
              </Link>
              {" · "}
              <a href="/data-docs/index.html" className="underline">
                Data model documentation
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

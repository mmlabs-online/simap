import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fraunces, DM_Sans } from "next/font/google";
import { iconFontHref } from "@/lib/icons";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { shellCopy } from "@/ui/copy/shell";
import "./globals.css";

// App font (variable, no weight list). next/font offers no vietnamese subset for DM Sans: latin-ext covers most
// Vietnamese letters; stacked tone marks fall back per glyph to the system sans (SIM-071 Q9).
const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  display: "swap",
});

// Sign-in headline font (D85, SIL OFL 1.1); preload off so other routes do not fetch it.
const serif = Fraunces({
  subsets: ["latin"],
  style: ["italic"],
  display: "swap",
  preload: false,
  variable: "--font-serif",
});

export const metadata: Metadata = { title: shellCopy.brand };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request header makes every page render per request, so the nonce reaches Next's own scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${dmSans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint (no flash). */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Icon font is global on purpose: the root layout loads it for every route. */}
        <link rel="stylesheet" href={iconFontHref()} />
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { headers } from "next/headers";
import { Manrope } from "next/font/google";
import { iconFontHref } from "@/lib/icons";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { shellCopy } from "@/ui/copy/shell";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = { title: shellCopy.brand };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request header makes every page render per request, so the nonce reaches Next's own scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
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

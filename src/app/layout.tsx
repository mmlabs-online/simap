import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { iconFontHref } from "@/lib/icons";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = { title: "simap" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={manrope.variable} suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Icon font is global on purpose: the root layout loads it for every route. */}
        <link rel="stylesheet" href={iconFontHref()} />
      </head>
      <body>{children}</body>
    </html>
  );
}

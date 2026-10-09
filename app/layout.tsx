import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif, Inter_Tight, Marcellus_SC, Space_Grotesk, Syne } from "next/font/google";
import type { CSSProperties } from "react";
import { getSettings } from "@/lib/cms/queries";
import { FONTS } from "@/lib/cms/settings-schema";
import "./globals.css";

// Theme font choices. All are self-hosted by next/font; a browser only
// downloads the faces the active theme actually uses.
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter-tight" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-space-grotesk", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-dm-sans", preload: false });
const syne = Syne({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-syne", preload: false });
const instrument = Instrument_Serif({ subsets: ["latin"], weight: ["400"], variable: "--font-instrument-serif", preload: false });
// project themes can use this one (lib/project-theme.ts) — e.g. Songs of Saaja
const marcellus = Marcellus_SC({ subsets: ["latin"], weight: ["400"], variable: "--font-marcellus-sc", preload: false });
const fontVars = [interTight, spaceGrotesk, dmSans, syne, instrument, marcellus].map((f) => f.variable).join(" ");

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings("site");
  return {
    metadataBase: new URL(site.url),
    title: { default: site.title, template: `%s — ${site.title.split(" — ")[0]}` },
    description: site.description,
    openGraph: { type: "website", siteName: site.title, images: site.ogImage ? [site.ogImage] : undefined },
    twitter: { card: "summary_large_image", site: site.twitter || undefined },
    alternates: { types: { "application/rss+xml": "/journal/feed.xml" } },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getSettings("theme");
  // CMS theme → CSS custom properties consumed by app/globals.css
  const style = {
    "--bg": theme.bg,
    "--fg": theme.fg,
    "--paper": theme.paper,
    "--ink": theme.ink,
    "--accent": theme.accent,
    "--font": `var(${FONTS[theme.fontBody].variable}), "Helvetica Neue", Arial, sans-serif`,
    "--font-display": `var(${FONTS[theme.fontDisplay].variable}), var(${FONTS[theme.fontBody].variable}), sans-serif`,
    "--ui-case": theme.uppercaseUi ? "uppercase" : "none",
    "--measure": theme.layout === "compact" ? "820px" : "none",
  } as CSSProperties;

  return (
    <html lang="en" className={fontVars} style={style}>
      <body>{children}</body>
    </html>
  );
}

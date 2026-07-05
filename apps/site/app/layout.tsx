import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const basePath: string = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = "https://nxt-solutions.github.io/holy-padel";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Holy Padel — local-first padel scoring",
  description:
    "Open-source padel score tracking with FIP-aware scoring, local match history, Apple Watch and Wear OS companions.",
  icons: {
    icon: `${basePath}/assets/brand/favicon.png`,
    apple: `${basePath}/assets/brand/icon.png`,
  },
  openGraph: {
    title: "Holy Padel",
    description: "A local-first padel score tracker for phone, Apple Watch, and Wear OS.",
    images: [`${siteUrl}/assets/screenshots/01-score-every-rally.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

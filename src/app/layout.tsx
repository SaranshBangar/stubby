import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Stubby — Mock APIs & uptime monitors, no signup",
    template: "%s · Stubby",
  },
  description:
    "Paste JSON, get a live mock endpoint. Watch any URL and get emailed when it goes down. No account, no login. Open the site and go.",
  keywords: [
    "mock api",
    "json mock endpoint",
    "uptime monitor",
    "http mock",
    "no signup developer tools",
  ],
  openGraph: {
    title: "Stubby — Mock APIs & uptime monitors, no signup",
    description:
      "Instant mock endpoints + uptime monitoring. Zero friction, no account required.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `dark` class makes dark mode the default render (no flash, no toggle dep).
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased font-sans">{children}</body>
    </html>
  );
}

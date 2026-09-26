import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono, Inter } from "next/font/google";
import { Analytics } from '@vercel/analytics/react';
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://cursor-qr.vercel.app'),
  title: "Grok Bot Credits QR Code Generator - SpaceXAI",
  description: "Generate printable QR codes from Cursor referral / credit links. Branded for Grok Bot by SpaceXAI. Client-side only — nothing is uploaded to a server.",
  keywords: ["QR code", "Grok", "Grok Bot", "SpaceXAI", "referral", "generator", "batch print", "CSV upload", "secure", "private", "client-side"],
  authors: [{ name: "SpaceXAI" }],
  creator: "Grok Bot / SpaceXAI",
  publisher: "SpaceXAI",
  
  // Open Graph
  openGraph: {
    type: "website",
    title: "Grok Bot Credits QR Code Generator - SpaceXAI",
    description: "Generate printable QR codes from Cursor referral / credit links. Branded for Grok Bot by SpaceXAI. All processing happens client-side.",
    url: "https://cursor-qr.vercel.app",
    siteName: "Grok Bot Credits QR Generator",
    images: [
      {
        url: "/og-img.png",
        width: 1200,
        height: 630,
        alt: "Grok Bot Credits QR Code Generator",
      },
    ],
  },
  
  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "Grok Bot Credits QR Code Generator - SpaceXAI",
    description: "Generate printable QR codes from Cursor referral / credit links. Branded for Grok Bot by SpaceXAI.",
    images: ["/og-img.png"],
    creator: "@xai",
  },
  
  // Favicon and icons
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png" },
    ],
  },
  
  // Web app manifest
  manifest: "/site.webmanifest",
  
  // Additional meta tags
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${ibmPlexMono.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}

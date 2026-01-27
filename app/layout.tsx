import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ✅ Viewport separato (Next 13/14/15)
export const viewport: Viewport = {
  themeColor: "#f4f6fb",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Pannello Prenotazioni",
  description: "Pannello admin prenotazioni",
  // ✅ QUESTO è fondamentale: linka il manifest nell'HTML
  manifest: "/manifest.webmanifest",
  // (opzionale ma utile per PWA)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pannello",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
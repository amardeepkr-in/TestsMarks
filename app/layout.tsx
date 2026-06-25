import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Marks & Admit Card Portal",
    template: "%s | Marks & Admit Card Portal",
  },
  description: "Upload, manage, and view student marks and admit cards. A free portal for educational institutions.",
  keywords: ["marks", "admit card", "student portal", "education", "results"],
  authors: [{ name: "TestMarks" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={outfit.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const theme = localStorage.getItem('app-theme') || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className={outfit.className}>
        <Toaster theme="dark" position="top-right" richColors closeButton />
        {children}
      </body>
    </html>
  );
}


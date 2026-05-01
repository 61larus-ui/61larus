import type { Metadata } from "next";
import { Geist, Geist_Mono, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import {
  HOME_PAGE_METADATA_TITLE,
  SITE_BRAND,
  SITE_DEFAULT_DESCRIPTION,
} from "@/lib/entry-seo-metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-libre-baskerville",
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://61larus.com"),
  title: HOME_PAGE_METADATA_TITLE,
  description: SITE_DEFAULT_DESCRIPTION,
  keywords: ["trabzon", "trabzon tarih", "trabzon gündem", "karadeniz"],
  openGraph: {
    title: HOME_PAGE_METADATA_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
    url: "https://61larus.com",
    siteName: SITE_BRAND,
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_PAGE_METADATA_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  alternates: {
    canonical: "https://61larus.com",
  },
  verification: {
    google: "otK0EamJ7liIaIKzHTz4NKpVUbfYfdf9oGDZKBkYvpU",
  },
  icons: {
    icon: "/favicon.png?v=3",
    shortcut: "/favicon.png?v=3",
    apple: "/favicon.png?v=3",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} ${libreBaskerville.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/favicon.png?v=3" />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <div className="app-shell mx-auto flex w-full max-w-[min(88rem,100%)] flex-col px-5 pb-10 pt-5 md:px-10 md:pb-12 md:pt-7 lg:px-14">
          {children}
        </div>
      </body>
    </html>
  );
}

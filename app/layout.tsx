import type { Metadata } from "next";
import { Geist, Geist_Mono, Libre_Baskerville } from "next/font/google";
import "./globals.css";

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
  title: "61LARUS",
  description: "Trabzon’un yaşayan bilgi bankası",
  keywords: ["trabzon", "trabzon tarih", "trabzon gündem", "karadeniz"],
  openGraph: {
    title: "61LARUS",
    description: "Trabzon’un yaşayan bilgi bankası",
    url: "https://61larus.com",
    siteName: "61LARUS",
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "61LARUS",
    description: "Trabzon’un yaşayan bilgi bankası",
  },
  alternates: {
    canonical: "https://61larus.com",
  },
  verification: {
    google: "otK0EamJ7liIaIKzHTz4NKpVUbfYfdf9oGDZKBkYvpU",
  },
  icons: {
    icon: "/favicon.png",
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
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <div className="app-shell mx-auto flex w-full max-w-[min(88rem,100%)] flex-col px-5 pb-10 pt-5 md:px-10 md:pb-12 md:pt-7 lg:px-14">
          {children}
        </div>
      </body>
    </html>
  );
}

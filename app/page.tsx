import type { Metadata } from "next";
import { Suspense } from "react";
import HomePageClient from "./home-page-client";
import { SITE_BRAND } from "@/lib/entry-seo-metadata";
import { getHomeClientProps } from "@/lib/home-client-props";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = "https://61larus.com";
const DEFAULT_HOME_DESCRIPTION = "Trabzon'un gündemi, lafı ve hafızası";

const defaultHomeMetadata = (): Metadata => ({
  title: SITE_BRAND,
  description: DEFAULT_HOME_DESCRIPTION,
  openGraph: {
    title: SITE_BRAND,
    description: DEFAULT_HOME_DESCRIPTION,
    url: SITE,
    type: "website",
    siteName: SITE_BRAND,
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_BRAND,
    description: DEFAULT_HOME_DESCRIPTION,
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE },
});

export async function generateMetadata(): Promise<Metadata> {
  return defaultHomeMetadata();
}

export default async function Home() {
  const result = await getHomeClientProps();
  if (!result.ok) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-12">
        <p className="max-w-md text-center text-sm leading-6 text-[#667085]">
          Hata: {result.message}
        </p>
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <HomePageClient {...result.props} />
    </Suspense>
  );
}

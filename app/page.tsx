import type { Metadata } from "next";
import { Suspense } from "react";
import HomePageClient from "./home-page-client";
import {
  HOME_PAGE_METADATA_TITLE,
  SITE_BRAND,
  SITE_DEFAULT_DESCRIPTION,
} from "@/lib/entry-seo-metadata";
import { getHomeClientProps } from "@/lib/home-client-props";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE = "https://61larus.com";

const defaultHomeMetadata = (): Metadata => ({
  title: HOME_PAGE_METADATA_TITLE,
  description: SITE_DEFAULT_DESCRIPTION,
  openGraph: {
    title: HOME_PAGE_METADATA_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
    url: SITE,
    type: "website",
    siteName: SITE_BRAND,
    locale: "tr_TR",
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_PAGE_METADATA_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
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

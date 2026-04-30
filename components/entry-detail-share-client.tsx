"use client";

import { slugifyEntryTitle } from "@/lib/entry-slug";

function entryPublicUrl(entryId: string, slug?: string | null): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin;
  const s = typeof slug === "string" ? slug.trim() : "";
  const segment = s.length > 0 ? s : slugifyEntryTitle("", entryId);
  return `${origin}/${encodeURI(segment)}`;
}

export function EntryDetailShareClient({
  entryId,
  title,
  slug,
}: {
  entryId: string;
  title: string;
  slug?: string | null;
}) {
  const copyEntryLink = () => {
    const url = entryPublicUrl(entryId, slug);
    void navigator.clipboard.writeText(`${title}\n${url}`);
  };

  const shareWhatsApp = () => {
    const link = entryPublicUrl(entryId, slug);
    const text = encodeURIComponent(`${title} ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const shareX = () => {
    const link = entryPublicUrl(entryId, slug);
    const text = encodeURIComponent(title);
    const url = encodeURIComponent(link);
    window.open(
      `https://x.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="entry-share-row">
      <button
        type="button"
        onClick={copyEntryLink}
        className="entry-share-btn"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>kopyala</span>
      </button>
      <button
        type="button"
        onClick={shareWhatsApp}
        className="entry-share-btn"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>whatsapp</span>
      </button>
      <button type="button" onClick={shareX} className="entry-share-btn">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.15}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <span>x</span>
      </button>
    </div>
  );
}

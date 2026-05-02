"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useCallback } from "react";
import { useT } from "@/lib/useT";

export type FeedEntryCardProps = {
  title: string;
  contentPreview: string;
  commentCount: number;
  authorLabel: string;
  /** Kısa tarih, örn. 12 Oca 2025 */
  metaDate: string;
  /** `dateTime` için ISO kaynak */
  createdAtRaw: string;
  isActive: boolean;
  onSelect: () => void;
  /** Hover’da RSC yolu önceden yüklenir, ör. /yazi-slug */
  prefetchHref?: string;
};

export function FeedEntryCard({
  title,
  contentPreview,
  commentCount,
  authorLabel,
  metaDate,
  createdAtRaw,
  isActive,
  onSelect,
  prefetchHref,
}: FeedEntryCardProps) {
  const router = useRouter();
  const t = useT("tr");
  const onPointerEnter = useCallback(() => {
    if (!prefetchHref) return;
    if (typeof router.prefetch === "function") {
      void router.prefetch(prefetchHref);
    }
  }, [prefetchHref, router]);
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? "true" : undefined}
      data-active={isActive ? "true" : undefined}
      onClick={onSelect}
      onPointerEnter={onPointerEnter}
      onKeyDown={handleKeyDown}
      className="feed-entry-card feed-entry-card--editorial group w-full min-w-0 cursor-pointer border-0 text-left last:border-b-0"
    >
      <div className="feed-entry-card-inner min-w-0">
        <h2 className="feed-entry-title feed-entry-title--editorial break-words">
          {title}
        </h2>
        <p className="entry-excerpt feed-entry-excerpt feed-entry-excerpt--editorial mt-1.5">
          {contentPreview}
        </p>
        <div className="feed-entry-bottom mt-3 flex min-w-0 flex-col gap-2 sm:mt-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <p className="feed-meta-row feed-meta-row--editorial m-0 flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[0.75rem] md:gap-x-2 md:text-[0.8125rem]">
            <span className="feed-meta-author min-w-0">{authorLabel}</span>
            {metaDate ? (
              <>
                <span
                  className="text-[color:var(--divide-muted)] opacity-75"
                  aria-hidden
                >
                  ·
                </span>
                <time
                  className="feed-meta-date text-[color:var(--text-meta)]"
                  dateTime={createdAtRaw}
                >
                  {metaDate}
                </time>
              </>
            ) : null}
            <span
              className="text-[color:var(--divide-muted)] opacity-75"
              aria-hidden
            >
              ·
            </span>
            <span
              className={`feed-meta-stat tabular-nums text-[color:var(--text-meta)]${
                commentCount === 0 ? " hemen-yorum-yok" : ""
              }`}
            >
              {commentCount === 0
                ? "Henüz yazılmamış"
                : `${commentCount} ${t.comments_count}`}
            </span>
          </p>
          <span className="feed-entry-cta read-more-link shrink-0 text-left sm:text-right">
            {t.read_more} →
          </span>
        </div>
      </div>
    </div>
  );
}

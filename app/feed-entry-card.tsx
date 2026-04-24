"use client";

import { type CSSProperties, type KeyboardEvent } from "react";

export type FeedEntryCardProps = {
  title: string;
  contentPreview: string;
  commentCount: number;
  readMinutes: number;
  categoryEyebrow: string;
  authorLabel: string;
  isActive: boolean;
  onSelect: () => void;
};

const previewClamp: CSSProperties = {
  fontSize: "14.5px",
  fontWeight: 400,
  color: "var(--text-secondary)",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  margin: 0,
};

export function FeedEntryCard({
  title,
  contentPreview,
  commentCount,
  readMinutes,
  categoryEyebrow,
  authorLabel,
  isActive,
  onSelect,
}: FeedEntryCardProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  }

  const initial = authorLabel.trim().charAt(0).toLocaleUpperCase("tr-TR") || "?";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? "true" : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="feed-entry-card group w-full cursor-pointer border-0 text-left transition-[background-color] duration-200 ease-out last:border-b-0 hover:bg-[var(--surface-hover)]"
      style={{
        background: isActive ? "var(--list-row-active)" : "transparent",
        boxShadow: isActive
          ? "inset 2px 0 0 0 var(--accent-green-line)"
          : undefined,
      }}
    >
      <div className="flex min-w-0 flex-col">
        <p className="feed-category-eyebrow">{categoryEyebrow}</p>
        <h2 className="feed-entry-title">{title}</h2>
        <p className="entry-excerpt mt-1 md:mt-1.5" style={previewClamp}>
          {contentPreview}
        </p>
        <div className="mt-3 flex min-w-0 flex-col gap-1.5 sm:mt-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3 md:mt-4">
          <div className="feed-meta-row flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 md:gap-x-2">
            <span
              className="flex h-[1.5rem] w-[1.5rem] shrink-0 items-center justify-center rounded-full border border-[color:var(--divide-hair)] bg-[var(--bg-secondary)] font-medium tabular-nums text-[color:var(--text-meta)] md:h-[1.55rem] md:w-[1.55rem]"
              aria-hidden
            >
              {initial}
            </span>
            <span className="feed-meta-author min-w-0 truncate">{authorLabel}</span>
            <span className="text-[color:var(--divide-muted)]" aria-hidden>
              ·
            </span>
            <span className="feed-meta-stat tabular-nums">
              {commentCount} yorum
            </span>
            <span className="text-[color:var(--divide-muted)]" aria-hidden>
              ·
            </span>
            <span className="feed-meta-stat tabular-nums">
              {readMinutes} dk okuma
            </span>
          </div>
          <span className="feed-read-more-cue shrink-0 text-right">Devamını oku →</span>
        </div>
      </div>
    </div>
  );
}

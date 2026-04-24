"use client";

import { type KeyboardEvent } from "react";

export type FeedEntryCardProps = {
  title: string;
  contentPreview: string;
  commentCount: number;
  authorLabel: string;
  isActive: boolean;
  onSelect: () => void;
};

export function FeedEntryCard({
  title,
  contentPreview,
  commentCount,
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

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? "true" : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className="feed-entry-card group w-full cursor-pointer border-0 text-left transition-[background-color,box-shadow] duration-150 ease-out last:border-b-0 hover:bg-[color-mix(in_srgb,var(--surface-hover)_88%,transparent)]"
      style={{
        background: isActive
          ? "color-mix(in srgb, var(--list-row-active) 92%, transparent)"
          : "transparent",
        boxShadow: isActive
          ? "inset 1px 0 0 0 color-mix(in srgb, var(--accent-green-line) 75%, transparent)"
          : undefined,
      }}
    >
      <div className="flex min-w-0 flex-col">
        <h2 className="feed-entry-title">{title}</h2>
        <p className="entry-excerpt feed-entry-excerpt mt-1 md:mt-1.5">
          {contentPreview}
        </p>
        <div className="mt-2.5 flex min-w-0 flex-col gap-1 sm:mt-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <div className="feed-meta-row flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 md:gap-x-2">
            <span className="feed-meta-author min-w-0 truncate">{authorLabel}</span>
            <span className="text-[color:var(--divide-muted)] opacity-80" aria-hidden>
              ·
            </span>
            <span className="feed-meta-stat tabular-nums">
              {commentCount} yorum
            </span>
          </div>
          <span className="feed-read-more-cue shrink-0 text-right opacity-90">
            Devamını oku →
          </span>
        </div>
      </div>
    </div>
  );
}

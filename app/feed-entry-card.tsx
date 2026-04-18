"use client";

import { type CSSProperties, type KeyboardEvent } from "react";

export type FeedEntryCardProps = {
  title: string;
  contentPreview: string;
  author: string;
  commentCount: number;
  isActive: boolean;
  onSelect: () => void;
};

const previewClamp: CSSProperties = {
  fontSize: "14px",
  fontWeight: 400,
  lineHeight: "1.76",
  color: "var(--text-secondary)",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  margin: 0,
  opacity: 0.93,
};

export function FeedEntryCard({
  title,
  contentPreview,
  author,
  commentCount,
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
      className="feed-entry-card group w-full cursor-pointer border-0 text-left transition-[background-color,box-shadow] duration-200 ease-out last:border-b-0 hover:bg-[var(--surface-hover)]"
      style={{
        background: isActive ? "var(--list-row-active)" : "transparent",
        boxShadow: isActive
          ? "inset 2px 0 0 0 var(--accent-green-line), 3px 0 18px -10px var(--accent-green-glow)"
          : undefined,
      }}
    >
      <div className="flex min-w-0 flex-col pl-0">
        <h2
          className={`m-0 text-[20px] leading-[1.23] tracking-[-0.026em] md:text-[22px] md:leading-[1.2] md:tracking-[-0.024em] ${
            isActive
              ? "text-[color:var(--accent-green)]"
              : "text-[color:var(--text-primary)] group-hover:text-[color:var(--text-primary)]"
          }`}
          style={{
            fontFamily: "var(--font-editorial-display)",
            fontWeight: 600,
            textRendering: "optimizeLegibility",
          }}
        >
          {title}
        </h2>
        <p className="mt-3 md:mt-[0.9375rem]" style={previewClamp}>
          {contentPreview}
        </p>
        <div className="mt-[1.0625rem] flex w-full min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 md:mt-[1.1875rem]">
          <p className="m-0 inline-block min-w-0 max-w-[calc(100%-5.25rem)] truncate align-baseline text-[12px] font-normal leading-snug tracking-[0.008em] text-[color:var(--text-muted)] tabular-nums">
            <span className="text-[color:var(--text-secondary)]">{author}</span>
            <span
              className="mx-1.5 inline-block translate-y-[-0.05em] text-[0.55rem] font-light text-[color:var(--divide-muted)]"
              aria-hidden
            >
              ·
            </span>
            <span className="text-[color:var(--text-tertiary)]">
              {commentCount} yorum
            </span>
          </p>
          <p className="m-0 inline-block shrink-0 align-baseline text-[10px] font-medium lowercase tracking-[0.14em] text-[color:var(--text-tertiary)] opacity-[0.92] transition-colors duration-200 group-hover:text-[color:var(--text-secondary)] group-hover:opacity-100">
            devamını oku
          </p>
        </div>
      </div>
    </div>
  );
}

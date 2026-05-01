import Link from "next/link";
import type { ReactNode } from "react";
import type { EntryItem } from "@/app/home-page-client";
import { EntryDetailCommentCompose } from "@/components/entry-detail-comment-compose";
import { EntryDetailShareClient } from "@/components/entry-detail-share-client";
import { SITE_BRAND } from "@/lib/entry-seo-metadata";

function formatEntryDetailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function EntryDetailBodyRsc({
  entry,
  commentAuth,
  commentsSlot,
}: {
  entry: EntryItem;
  commentAuth: {
    isAuthenticated: boolean;
    initialAgreementDone: boolean;
    initialPlatformAccessSuspended: boolean;
  };
  /** Entry detail yorum listesi (RSC) */
  commentsSlot: ReactNode;
}) {
  const authorName = entry.authorName?.trim() || SITE_BRAND;
  const formattedDate = formatEntryDetailDate(entry.created_at);

  return (
    <div className="relative z-0 max-w-none">
      <div className="entry-detail-back-row flex flex-col gap-0.5 md:flex-row md:items-center">
        <Link href="/" prefetch scroll={false} className="entry-detail-back">
          ← Akışa dön
        </Link>
      </div>

      <article className="entry-detail-article m-0 border-0 p-0">
        <header className="m-0 border-0 p-0">
          <h1 id="entry-detail-title" className="entry-detail-title">
            {entry.title}
          </h1>
          <div className="entry-meta">
            <span className="entry-author">{authorName}</span>
            <span className="entry-dot" aria-hidden>
              •
            </span>
            <span className="entry-date">{formattedDate}</span>
          </div>
        </header>
        <section
          aria-labelledby="entry-detail-title"
          className="m-0 border-0 p-0"
        >
          <p className="entry-detail-body">{entry.content}</p>
        </section>
      </article>

      <EntryDetailShareClient
        entryId={entry.id}
        title={entry.title}
        slug={entry.slug}
      />

      {commentsSlot}

      <EntryDetailCommentCompose
        entryId={entry.id}
        isAuthenticated={commentAuth.isAuthenticated}
        initialAgreementDone={commentAuth.initialAgreementDone}
        initialPlatformAccessSuspended={
          commentAuth.initialPlatformAccessSuspended
        }
      />
    </div>
  );
}

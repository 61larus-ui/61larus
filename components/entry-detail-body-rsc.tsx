import Link from "next/link";
import type { CommentItem, EntryItem } from "@/app/home-page-client";
import { EntryDetailCommentCompose } from "@/components/entry-detail-comment-compose";
import { EntryDetailShareClient } from "@/components/entry-detail-share-client";

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("tr-TR");
}

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
  comments,
  commentAuth,
}: {
  entry: EntryItem;
  comments: CommentItem[];
  commentAuth: {
    isAuthenticated: boolean;
    initialAgreementDone: boolean;
    initialPlatformAccessSuspended: boolean;
  };
}) {
  const authorName = entry.authorName?.trim() || "61Larus";
  const formattedDate = formatEntryDetailDate(entry.created_at);
  const commentList = comments;

  return (
    <div className="relative z-0 max-w-none">
      <div className="entry-detail-back-row flex flex-col gap-0.5 md:flex-row md:items-center">
        <Link href="/" scroll={false} className="entry-detail-back">
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

      <section className="entry-comments-section" aria-label="Yorumlar">
        {commentList.length === 0 ? (
          <div className="entry-comments-empty">ilk yorumu sen yaz</div>
        ) : (
          <div className="flex flex-col">
            {commentList.map((comment, index) => (
              <div
                key={comment.id}
                className={`entry-comment-item${index > 0 ? " entry-comment-item--follows" : ""}`}
              >
                <p className="entry-comment-author">{comment.authorLabel}</p>
                {comment.bio61?.trim() ? (
                  <p className="entry-comment-bio">{comment.bio61.trim()}</p>
                ) : null}
                <p className="entry-comment-text">{comment.content}</p>
                <div className="entry-comment-meta">
                  <time dateTime={comment.created_at}>
                    {formatDate(comment.created_at)}
                  </time>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

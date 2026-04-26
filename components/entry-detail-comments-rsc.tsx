import { getCommentItemsForEntryRow } from "@/lib/entry-route-data";
import type { EntryRow } from "@/lib/entry-route-data";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleString("tr-TR");
}

export async function EntryDetailCommentsRsc({ row }: { row: EntryRow }) {
  const supabase = await createSupabaseServerClient();
  const commentList = await getCommentItemsForEntryRow(supabase, row);

  return (
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
  );
}

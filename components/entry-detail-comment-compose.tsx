"use client";

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Props = {
  entryId: string;
  isAuthenticated: boolean;
  initialAgreementDone: boolean;
  initialPlatformAccessSuspended: boolean;
};

export function EntryDetailCommentCompose({
  entryId,
  isAuthenticated,
  initialAgreementDone,
  initialPlatformAccessSuspended,
}: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clientHasSession, setClientHasSession] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void supabase.auth
      .getSession()
      .then((res: { data: { session: Session | null } }) => {
        setClientHasSession(!!res.data.session);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, sess: Session | null) => {
        setClientHasSession(!!sess);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const sessionActive =
    clientHasSession !== null ? clientHasSession : isAuthenticated;

  const canWrite =
    sessionActive &&
    initialAgreementDone &&
    !initialPlatformAccessSuspended;

  const onSubmit = useCallback(async () => {
    if (!canWrite || submitting) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        setFormError("Oturum bulunamadı. Yeniden giriş yap.");
        setSubmitting(false);
        return;
      }
      const { error } = await supabase.from("comments").insert({
        entry_id: entryId,
        user_id: user.id,
        content: trimmed,
        parent_comment_id: null,
        reply_to_user_id: null,
        reply_to_username: null,
      });
      if (error) {
        setFormError(error.message || "Yorum gönderilemedi.");
        setSubmitting(false);
        return;
      }
      setText("");
      router.refresh();
    } catch {
      setFormError("Ağ hatası.");
    } finally {
      setSubmitting(false);
    }
  }, [canWrite, submitting, text, entryId, router]);

  if (!sessionActive) {
    return (
      <div className="entry-comment-compose-wrap">
        <p className="m-0 text-sm leading-relaxed text-[color:var(--text-secondary)]">
          Yorum yazmak için{" "}
          <Link
            href="/auth"
            className="underline decoration-[color:var(--divide-muted)] underline-offset-[3px] hover:text-[color:var(--text-primary)]"
          >
            giriş
          </Link>{" "}
          yap.
        </p>
      </div>
    );
  }

  if (initialPlatformAccessSuspended) {
    return (
      <div className="entry-comment-compose-wrap">
        <p className="m-0 text-sm leading-relaxed text-[color:var(--text-secondary)]">
          Hesabın yorum yazmaya kapalı. Üstteki bilgilendirmeye bakabilirsin.
        </p>
      </div>
    );
  }

  if (!initialAgreementDone) {
    return (
      <div className="entry-comment-compose-wrap">
        <p className="m-0 text-sm leading-relaxed text-[color:var(--text-secondary)]">
          Yorum yazmak için önce{" "}
          <Link
            href="/"
            className="underline decoration-[color:var(--divide-muted)] underline-offset-[3px] hover:text-[color:var(--text-primary)]"
            scroll={false}
          >
            ana sayfada
          </Link>{" "}
          sözleşmeyi tamamlaman gerekir.
        </p>
      </div>
    );
  }

  return (
    <div className="entry-comment-compose-wrap">
      <div className="entry-comment-compose">
        <p className="comment-box-label">Sen ne düşünüyorsun?</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Düşünceni yaz…"
          className="entry-comment-textarea"
          rows={2}
          disabled={submitting}
          aria-label="Yorum yaz"
        />
        {formError ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {formError}
          </p>
        ) : null}
        <div className="entry-comment-actions">
          <button
            type="button"
            className="entry-comment-submit"
            disabled={submitting || !text.trim()}
            onClick={() => void onSubmit()}
          >
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

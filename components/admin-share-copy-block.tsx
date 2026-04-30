"use client";

import { useCallback, useMemo, useState } from "react";
import {
  buildShareCopySuggestions,
  type ShareCopyVariant,
} from "@/lib/admin-share-copy";
import { publicSiteEntryUrl } from "@/lib/public-site-entry-url";

type Props = {
  title: string;
  content: string;
  entryId: string | null;
  /** Path segment; yoksa entry id tabanlı slug. */
  entrySlug?: string | null;
};

function publicEntryUrl(
  entryId: string,
  entrySlug: string | null | undefined
): string {
  return publicSiteEntryUrl(entryId, entrySlug);
}

function buildFinalText(
  suggestionText: string,
  entryId: string,
  entrySlug: string | null | undefined
): string {
  const url = publicEntryUrl(entryId, entrySlug);
  return suggestionText.replace(/{LINK}/g, url);
}

function displayLine(
  raw: string,
  entryId: string | null,
  entrySlug: string | null | undefined
): string {
  if (!entryId) return raw;
  if (typeof window === "undefined") return raw;
  const url = publicEntryUrl(entryId, entrySlug);
  return raw.replace(/{LINK}/g, url);
}

const btnBase =
  "admin-btn-text shrink-0 rounded-md border px-2 py-1 text-xs transition-colors";
const btnDisabled =
  "border-slate-600 text-slate-500 opacity-50 cursor-not-allowed hover:!bg-transparent hover:!border-slate-600";
const btnEnabled =
  "cursor-pointer border-slate-500 text-slate-200 hover:border-emerald-500/70 hover:bg-emerald-900/25 hover:text-emerald-100";

export function AdminShareCopyBlock({
  title,
  content,
  entryId,
  entrySlug,
}: Props) {
  const items = useMemo(
    () => buildShareCopySuggestions(title, content),
    [title, content]
  );
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const canSend = Boolean(entryId);

  const onSendX = useCallback(
    (key: ShareCopyVariant, text: string) => {
      if (!entryId) return;
      setOpeningKey(`${key}-x`);
      const finalText = buildFinalText(text, entryId, entrySlug);
      const u = `https://x.com/intent/tweet?text=${encodeURIComponent(finalText)}`;
      window.open(u, "_blank", "noopener,noreferrer");
      window.setTimeout(() => setOpeningKey(null), 2000);
    },
    [entryId, entrySlug]
  );

  const onSendWhatsApp = useCallback(
    (key: ShareCopyVariant, text: string) => {
      if (!entryId) return;
      setOpeningKey(`${key}-wa`);
      const finalText = buildFinalText(text, entryId, entrySlug);
      const u = `https://api.whatsapp.com/send?text=${encodeURIComponent(finalText)}`;
      window.open(u, "_blank", "noopener,noreferrer");
      window.setTimeout(() => setOpeningKey(null), 2000);
    },
    [entryId, entrySlug]
  );

  return (
    <div className="mt-5 border-t border-slate-800 pt-5">
      <h3 className="admin-subsection-title m-0 text-slate-200">
        Paylaşım metni önerileri
      </h3>
      <p className="admin-helper mt-1 text-xs text-slate-500">
        {canSend ? (
          <>
            Aşağıdaki metinde{" "}
            <code className="admin-code">{"{LINK}"}</code> yerine gerçek entry
            adresi gösteriliyor. Gönder tam metni aynı şekilde kullanır. Öneri
            uzunluğu en fazla 280 karakter.
          </>
        ) : (
          <>
            Öneri metinleri en fazla 280 karakter.{" "}
            <code className="admin-code">{"{LINK}"}</code> yayından sonra
            otomatik adrese dönüşür.
          </>
        )}
      </p>
      {!canSend ? (
        <p className="mt-2 text-xs leading-relaxed text-amber-200/90">
          Paylaşım butonları, entry yayınlandıktan sonra aktif olur.
        </p>
      ) : null}
      <ul className="mt-3 list-none space-y-4 p-0">
        {items.map((item) => (
          <li
            key={item.key}
            className="rounded-lg border border-slate-800/90 bg-slate-950/50 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="admin-label m-0 text-slate-400">
                {item.label}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => onSendX(item.key, item.text)}
                  className={`${btnBase} ${!canSend ? btnDisabled : btnEnabled}`}
                >
                  {openingKey === `${item.key}-x` ? "Açılıyor..." : "X Gönder"}
                </button>
                <button
                  type="button"
                  disabled={!canSend}
                  onClick={() => onSendWhatsApp(item.key, item.text)}
                  className={`${btnBase} ${!canSend ? btnDisabled : btnEnabled}`}
                >
                  {openingKey === `${item.key}-wa`
                    ? "Açılıyor..."
                    : "WhatsApp Gönder"}
                </button>
              </div>
            </div>
            <p className="admin-td-mono mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
              {displayLine(item.text, entryId, entrySlug)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

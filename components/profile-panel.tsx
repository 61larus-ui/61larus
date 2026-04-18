"use client";

import { useEffect, useState, type FormEvent } from "react";
import { anonymizeCurrentUserAccount } from "@/lib/anonymize-account";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type DisplayMode = "nickname" | "real_name";

type PendingReturn = {
  entryId: string | null;
  action: string | null;
};

export type ProfileSaveResult = {
  pending: PendingReturn;
  fullName: string;
  nickname: string | null;
  displayMode: DisplayMode;
  avatarUrl: string | null;
};

const LS_PENDING_ENTRY = "pendingEntryId";
const LS_PENDING_ACTION = "pendingAction";

type Props = {
  onComplete: (result: ProfileSaveResult) => void | Promise<void>;
  /** After profile row is anonymized; parent should sign out and reset UI. */
  onAccountDeleted?: () => void | Promise<void>;
  initialFullName?: string | null;
  initialNickname?: string | null;
  initialDisplayMode?: DisplayMode | null;
  /** Existing saved avatar URL when user does not upload a new file */
  initialAvatarUrl?: string | null;
  /** Preview fallback when no saved upload (e.g. Google avatar) — after saved in priority */
  oauthAvatarUrl?: string | null;
};

const inputClass =
  "h-11 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 text-sm text-[#1F2937] outline-none transition placeholder:text-[#A0ABB8] focus:border-[#5F7A61] focus:outline-none focus:ring-0";

const textareaClass =
  "min-h-[5.5rem] w-full resize-none rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm leading-7 text-[#1F2937] outline-none transition placeholder:text-[#A0ABB8] focus:border-[#5F7A61] focus:outline-none focus:ring-0";

const labelEyebrow =
  "text-xs font-semibold uppercase tracking-[0.12em] text-[#8B95A5]";

export default function ProfilePanel({
  onComplete,
  onAccountDeleted,
  initialFullName,
  initialNickname,
  initialDisplayMode,
  initialAvatarUrl,
  oauthAvatarUrl,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirm">("idle");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [nickname, setNickname] = useState(initialNickname ?? "");
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    initialDisplayMode ?? "real_name"
  );
  const [bio61, setBio61] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    setFullName(initialFullName ?? "");
    setNickname(initialNickname ?? "");
    setDisplayMode(initialDisplayMode ?? "real_name");
  }, [initialFullName, initialNickname, initialDisplayMode]);

  useEffect(() => {
    const client = createSupabaseBrowserClient();
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!user || cancelled) return;
      const { data: row } = await client
        .from("users")
        .select("bio_61")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled || !row) return;
      const b = row.bio_61;
      if (typeof b === "string" && b.length > 0) {
        setBio61(b.length > 61 ? b.slice(0, 61) : b);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (displayMode === "nickname" && !nickname.trim()) {
      setDisplayMode("real_name");
    }
  }, [nickname, displayMode]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  function validate(): string | null {
    const fn = fullName.trim();
    const nick = nickname.trim();
    if (!fn) {
      return "Ad Soyad zorunludur.";
    }
    if (displayMode === "nickname" && !nick) {
      return "Takma ad seçildiğinde takma ad zorunludur.";
    }
    if (bio61.length > 61) {
      return "Bio en fazla 61 karakter olabilir.";
    }
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("Oturum bulunamadı.");
        return;
      }

      let avatarUrl: string | null = null;
      if (avatarFile) {
        const path = `${user.id}/${Date.now()}-${avatarFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) {
          setError(uploadError.message);
          return;
        }
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = pub.publicUrl;
      }

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("users")
        .update({
          first_name: fullName.trim(),
          last_name: null,
          nickname: nickname.trim() || null,
          display_name_mode: displayMode,
          email: user.email ?? null,
          birth_date: null,
          gender: null,
          phone: null,
          bio_61: bio61.trim() || null,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          onboarding_completed_at: now,
          updated_at: now,
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      const pending: PendingReturn =
        typeof window !== "undefined"
          ? {
              entryId: localStorage.getItem(LS_PENDING_ENTRY),
              action: localStorage.getItem(LS_PENDING_ACTION),
            }
          : { entryId: null, action: null };

      const resolvedAvatarUrl = avatarUrl ?? initialAvatarUrl ?? null;

      await onComplete({
        pending,
        fullName: fullName.trim(),
        nickname: nickname.trim() || null,
        displayMode,
        avatarUrl: resolvedAvatarUrl,
      });
    } finally {
      setLoading(false);
    }
  }

  async function confirmAccountDeletion() {
    setError(null);
    setDeleteLoading(true);
    try {
      const { error: delError } = await anonymizeCurrentUserAccount();
      if (delError) {
        setError(delError);
        return;
      }
      if (onAccountDeleted) {
        await onAccountDeleted();
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  const nicknameDisabled = !nickname.trim();

  const persistedOrOAuthPreview =
    !avatarFile ? (initialAvatarUrl ?? oauthAvatarUrl ?? null) : null;
  const avatarImageSrc = avatarPreview ?? persistedOrOAuthPreview;

  return (
    <div className="w-full rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-8">
      <div className="space-y-12">
        <header className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-[#1F2937] md:text-3xl">
            Profilini düzenle
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-[#8B95A5]">
            İstersen bilgilerini güncelle; görünen adını seçmek zorunludur.
          </p>
        </header>

        <form
          onSubmit={onSubmit}
          className="max-h-[58vh] space-y-9 overflow-y-auto pr-1"
        >
          <div className="space-y-4">
            <p className={labelEyebrow}>Profil fotoğrafı (isteğe bağlı)</p>
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F0EFEC] ring-1 ring-[#E7E5E4]/80">
                {avatarImageSrc ? (
                  <img
                    src={avatarImageSrc}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-[#A0ABB8]">—</span>
                )}
              </div>
              <label className="cursor-pointer text-sm text-[#667085] underline decoration-[#D0D5DD]/80 underline-offset-4 transition-colors hover:text-[#5F7A61]">
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                />
                Dosya seç
              </label>
            </div>
          </div>

          <label className="block space-y-2">
            <span className={labelEyebrow}>Ad Soyad</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              required
            />
          </label>

          <label className="block space-y-2">
            <span className={labelEyebrow}>Takma ad</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={inputClass}
            />
          </label>

          <div className="block space-y-2">
            <span className={labelEyebrow}>Kendini 61 karakterle anlat</span>
            <textarea
              value={bio61}
              onChange={(e) => setBio61(e.target.value.slice(0, 61))}
              maxLength={61}
              placeholder="Trabzon’da doğdum, kahve bağımlısıyım..."
              className={textareaClass}
            />
            <p className="text-xs tabular-nums text-[#A0ABB8]">{bio61.length} / 61</p>
          </div>

          <fieldset className="space-y-3 border-0 p-0">
            <legend className={`${labelEyebrow} mb-1`}>Hangi isim görünsün?</legend>
            <div className="space-y-2.5">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-normal text-[#1F2937]">
                <input
                  type="radio"
                  name="display"
                  checked={displayMode === "real_name"}
                  onChange={() => setDisplayMode("real_name")}
                  className="h-3.5 w-3.5 shrink-0 border-[#D0D5DD] text-[#1F2937] focus:ring-0 focus:ring-offset-0"
                />
                Ad Soyad
              </label>
              <label
                className={`flex cursor-pointer items-center gap-3 text-sm font-normal ${nicknameDisabled ? "text-[#A0ABB8]" : "text-[#1F2937]"}`}
              >
                <input
                  type="radio"
                  name="display"
                  checked={displayMode === "nickname"}
                  disabled={nicknameDisabled}
                  onChange={() => setDisplayMode("nickname")}
                  className="h-3.5 w-3.5 shrink-0 border-[#D0D5DD] text-[#1F2937] focus:ring-0 focus:ring-offset-0 disabled:opacity-40"
                />
                Takma ad
              </label>
            </div>
          </fieldset>

          {error ? (
            <p className="text-sm leading-relaxed text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#1A1A1A] px-5 text-sm font-medium text-white transition-colors hover:bg-[#2A2A2A] disabled:opacity-40"
          >
            {loading ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </form>

        <div className="space-y-4 pt-2">
          <p className={labelEyebrow}>Hesap</p>
          {deleteStep === "idle" ? (
            <button
              type="button"
              disabled={loading || deleteLoading}
              onClick={() => setDeleteStep("confirm")}
              className="text-left text-sm font-normal text-[#8B95A5] underline decoration-[#D0D5DD]/70 underline-offset-4 transition-colors hover:text-red-800 disabled:opacity-40"
            >
              Hesabımı sil
            </button>
          ) : (
            <div className="space-y-5">
              <p className="text-sm font-medium leading-relaxed text-[#1F2937]">
                Bu işlem geri alınamaz.
              </p>
              <p className="text-sm leading-relaxed text-[#8B95A5]">
                Hesabın bu cihazda kapatılır ve profil bilgilerin kaldırılır. Eski entry
                ve yorumların sistemde kalır, ama anonim / silinmiş kullanıcı olarak
                görünür.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => void confirmAccountDeletion()}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200/80 bg-white px-4 text-sm font-medium text-red-800 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  {deleteLoading ? "İşleniyor…" : "Silmeyi onayla"}
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setDeleteStep("idle")}
                  className="inline-flex h-10 items-center justify-center text-sm font-normal text-[#667085] underline decoration-[#D0D5DD]/70 underline-offset-4 transition-colors hover:text-[#5F7A61] disabled:opacity-40"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

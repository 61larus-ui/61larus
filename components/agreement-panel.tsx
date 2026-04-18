"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export const AGREEMENT_COPY = `Üyelik Sözleşmesi ve Kullanım Koşulları

1. Genel
61larus platformuna erişerek ve kullanarak, aşağıdaki koşulları okuduğunuzu ve kabul ettiğinizi beyan edersiniz. Bu metin, platform ile ilişkinizi düzenler.

2. İçerik sorumluluğu
Kullanıcılar, paylaştıkları tüm içeriklerden bizzat sorumludur. Paylaşımlarınızın yürürlükteki mevzuata, üçüncü kişilerin haklarına ve bu kurallara uygun olması gerekir.

3. Yasadışı veya zararlı içerik
Hukuka aykırı olduğu tespit edilen veya platform kurallarını ihlal eden içerikler uyarılmaksızın kaldırılabilir, erişime kapatılabilir veya sınırlandırılabilir.

4. Örnek ihlal alanları (sınırlı örnekler)
Aşağıdaki başlıklar, ihlal türlerini özetler; örnekler tam liste değildir.

• Hakaret: Kişilerin onurunu rencide edebilecek ağır söylem veya sürekli saldırgan üslup.
• Tehdit: Başkasına yönelik fiili veya ciddi korku uyandıran tehdit içeren paylaşımlar.
• Aşağılama / nefret içerikli söylem: Grupları veya kişileri kimlikleri nedeniyle hedef alan, aşağılayıcı veya nefret söylemi içeren içerik.

5. Hukuki işbirliği
Platform, yasal düzenlemeler ve geçerli yargı kararları çerçevesinde yetkili mercilerle sınırlı ve gerekli ölçüde iş birliği yapabilir.

6. Sorumluluk reddi (kullanıcı içeriği)
Platform, kullanıcılar tarafından üretilen içeriklerin doğruluğunu, yasallığını veya üçüncü kişiler için sonuçlarını garanti etmez. Kullanıcı içeriğinden doğan zararlarda, yürürlükteki hukukun izin verdiği ölçüde platform sorumlu tutulamaz.

7. Kabul
Aşağıdaki kutuyu işaretleyerek bu metni okuduğunuzu ve koşulları kabul ettiğinizi onaylarsınız.`;

type Props = {
  onSuccess: () => void | Promise<void>;
};

export default function AgreementPanel({ onSuccess }: Props) {
  const supabase = createSupabaseBrowserClient();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setError(null);
    setLoading(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setError("Oturum bulunamadı. Lütfen tekrar giriş yapın.");
        return;
      }
      const now = new Date().toISOString();
      const meta = user.user_metadata as {
        full_name?: string;
        avatar_url?: string;
      };
      const nicknameFromGoogle =
        typeof meta?.full_name === "string" && meta.full_name.trim().length > 0
          ? meta.full_name.trim()
          : null;
      const avatarFromGoogle =
        typeof meta?.avatar_url === "string" && meta.avatar_url.trim().length > 0
          ? meta.avatar_url.trim()
          : null;

      const { error: updateError } = await supabase
        .from("users")
        .update({
          agreement_accepted_at: now,
          onboarding_completed_at: now,
          updated_at: now,
          ...(nicknameFromGoogle
            ? {
                first_name: nicknameFromGoogle,
                last_name: null,
                nickname: nicknameFromGoogle,
                display_name_mode: "real_name",
              }
            : {}),
          ...(avatarFromGoogle ? { avatar_url: avatarFromGoogle } : {}),
        })
        .eq("id", user.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      await Promise.resolve(onSuccess());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#E7E5E4] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] md:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-[#1F2937] md:text-3xl">
            Üyelik koşulları
          </h2>
        </div>
        <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-[#E7E5E4] bg-[#F6F5F2] p-4 text-[15px] leading-7 text-[#667085] md:text-base md:p-5 whitespace-pre-wrap">
          {AGREEMENT_COPY}
        </div>
        <label className="flex items-start gap-3 text-sm leading-6 text-[#1F2937]">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#D0D5DD] text-[#1F2937] focus:ring-0 focus:ring-offset-0"
          />
          <span>Okudum ve kabul ediyorum</span>
        </label>
        {error ? (
          <p className="text-sm leading-6 text-red-700">{error}</p>
        ) : null}
        <button
          type="button"
          disabled={!accepted || loading}
          onClick={onContinue}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1A1A1A] px-5 text-sm font-medium text-white transition-colors hover:bg-[#2A2A2A] disabled:pointer-events-none disabled:opacity-40"
        >
          {loading ? "Kaydediliyor…" : "Devam et"}
        </button>
      </div>
    </div>
  );
}

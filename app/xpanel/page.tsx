"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type LarusEntry,
  contentPreview,
  fetchEntries,
  loadEntriesPoolFromStorage,
  mergeAndNormalizePool,
  saveEntriesPoolToStorage,
} from "@/lib/larus-entry-pool";

const CATEGORIES = [
  "Gündem",
  "Trabzonspor",
  "Şehir",
  "Kültür",
  "Hafıza",
  "Riskli",
] as const;

type Category = (typeof CATEGORIES)[number];

const HEDEF_HESAP_KATEGORILERI = [
  "Yerel medya",
  "Trabzonspor",
  "Belediye",
  "Gazeteci",
  "Kültür",
  "Vatandaş",
  "Riskli",
] as const;

type HedefHesapKategorisi = (typeof HEDEF_HESAP_KATEGORILERI)[number];

type HedefHesapDurumu = "İzlenecek" | "Takip edildi" | "Uzak dur";

type HedefHesap = {
  id: string;
  handle: string;
  kategori: HedefHesapKategorisi;
  not: string;
  durum: HedefHesapDurumu;
};

type Tweet = {
  id: string;
  category: Category;
  author: string;
  handle: string;
  time: string;
  text: string;
  stats: { replies: number; reposts: number; likes: number };
};

const MOCK_DAILY_TARGETS = {
  followGoal: 20,
  followDone: 12,
  commentGoal: 10,
  commentDone: 7,
  likeGoal: 10,
  likeDone: 8,
} as const;

const ORNEK_AKIS_TOHUMU: Tweet[] = [
  {
    id: "1",
    category: "Gündem",
    author: "Ece Yılmaz",
    handle: "61larus_operasyon",
    time: "12 dk",
    text: "Bugün 61Larus X Operasyon Paneli’nde görev dağılımını güncelledik. Trabzon sahasında saha ile merkez arasında net iletişim, en hızlı sonuç yolu.",
    stats: { replies: 14, reposts: 28, likes: 312 },
  },
  {
    id: "2",
    category: "Trabzonspor",
    author: "Maraton Tribün",
    handle: "ts61_maraton",
    time: "25 dk",
    text: "Maç günü öncesi: şehir merkezine erken gelin, hatlar dolmadan yerini al. 61Larus hatırlatması: güvenlik birimiyle koordinasyon açık.",
    stats: { replies: 203, reposts: 890, likes: 4_200 },
  },
  {
    id: "3",
    category: "Şehir",
    author: "Karadeniz Lojistik",
    handle: "trabzon_ekip",
    time: "1 sa",
    text: "Büyükşehir çevresinde yol çalışması: alternatif güzergâh haritası panelde. Yönlendirme ekibi 14.00’te noktada; anlık durum paylaşılacak.",
    stats: { replies: 42, reposts: 190, likes: 1204 },
  },
  {
    id: "4",
    category: "Kültür",
    author: "Trabzon Etkinlik",
    handle: "etkinlik61",
    time: "2 sa",
    text: "Hamsi Festivali çevresinde ulaşım ve sıra düzeni netleşti. Gönüllü noktaları için 61Larus üzerinden kayıt akışı açık.",
    stats: { replies: 31, reposts: 156, likes: 980 },
  },
  {
    id: "5",
    category: "Hafıza",
    author: "61Larus İletişim",
    handle: "larusx_tr",
    time: "4 sa",
    text: "Arşiv notu: 2010’daki ilk saha protokolü, bugünkü Böcek Hattı özetleriyle aynı disiplini taşıyor. Tarihî referansı panelde sabitledik.",
    stats: { replies: 6, reposts: 55, likes: 420 },
  },
  {
    id: "6",
    category: "Riskli",
    author: "Onur Bektaş",
    handle: "bocek_hatti",
    time: "5 sa",
    text: "Sert çıkış: operasyon görünürlüğü sadece ekrandan ibaret değil—sahadaki notun panelde güncellenmemesi riskin kendisi. Kim sorumlu?",
    stats: { replies: 89, reposts: 401, likes: 2890 },
  },
];

function kullaniciAdiniNormalizeEt(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/\s+/g, "");
}

function rastgeleGonderiMetrikleri(): Tweet["stats"] {
  return {
    replies: 2 + Math.floor(Math.random() * 180),
    reposts: 1 + Math.floor(Math.random() * 120),
    likes: 5 + Math.floor(Math.random() * 3200),
  };
}

let manuelTweetIdSayaç = 0;

function yeniManuelTweetOlustur(
  kullaniciRaw: string,
  metin: string,
  kategori: Category,
): Tweet {
  const handle = kullaniciAdiniNormalizeEt(kullaniciRaw);
  const guvenliHandle = handle || "kullanici";
  manuelTweetIdSayaç += 1;
  return {
    id: `manuel-${Date.now()}-${manuelTweetIdSayaç}-${Math.random().toString(36).slice(2, 9)}`,
    category: kategori,
    author: `@${guvenliHandle}`,
    handle: guvenliHandle,
    time: "Şimdi",
    text: metin.trim(),
    stats: rastgeleGonderiMetrikleri(),
  };
}

/** Linkten mock doldurma: gerçek API yok */
const TWEET_LINK_MOCK_METIN =
  "Trabzon gündeminde dikkat çeken bir gelişme...";

function tweetLinkindenKullaniciAyikla(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let urlStr = s;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (
      host !== "x.com" &&
      host !== "twitter.com" &&
      host !== "mobile.twitter.com"
    ) {
      return null;
    }
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const rezerve = new Set([
      "i",
      "intent",
      "settings",
      "explore",
      "home",
      "search",
      "messages",
      "notifications",
      "compose",
      "hashtag",
    ]);
    const ilk = parts[0];
    if (rezerve.has(ilk.toLowerCase())) return null;
    if (!/^[A-Za-z0-9_]{1,30}$/.test(ilk)) return null;
    return ilk;
  } catch {
    return null;
  }
}

function metinDislastir(metin: string): string {
  return metin
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

type AkilliKategoriSonucu = { kategori: Category; neden: string };

function akilliKategoriOneri(metin: string): AkilliKategoriSonucu {
  const t = metin.toLowerCase();
  const tAscii = metinDislastir(metin);

  if (
    t.includes("kavga") ||
    t.includes("hakaret") ||
    t.includes("küfür") ||
    t.includes("kufur") ||
    t.includes("tehdit") ||
    t.includes("linç") ||
    t.includes("linc")
  ) {
    return {
      kategori: "Riskli",
      neden:
        "Metin; çatışma, linç, hakaret veya tehdit diline dönük ifadeler barındırıyor.",
    };
  }
  if (
    t.includes("maç") ||
    t.includes("mac") ||
    t.includes("gol") ||
    t.includes("tribün") ||
    t.includes("tribun") ||
    t.includes("bordo") ||
    t.includes("mavi") ||
    t.includes("futbol") ||
    t.includes("stadyum")
  ) {
    return {
      kategori: "Trabzonspor",
      neden:
        "Metin; maç, gol, tribün, renkler veya stadyum bağlamıyla örtüşüyor.",
    };
  }
  if (
    t.includes("belediye") ||
    t.includes("yol") ||
    t.includes("trafik") ||
    t.includes("ulaşım") ||
    t.includes("ulasim") ||
    t.includes("altyapı") ||
    t.includes("altyapi") ||
    t.includes("meydan") ||
    t.includes("otopark")
  ) {
    return {
      kategori: "Şehir",
      neden:
        "Metin; belediye, ulaşım, altyapı veya kentsel düzenle ilgili terimler taşıyor.",
    };
  }
  if (
    t.includes("festival") ||
    t.includes("etkinlik") ||
    t.includes("konser") ||
    t.includes("sergi") ||
    t.includes("tiyatro")
  ) {
    return {
      kategori: "Kültür",
      neden:
        "Metin; festival, etkinlik, sanat veya sahne alanına işaret ediyor.",
    };
  }
  if (
    t.includes("tarih") ||
    t.includes("eski") ||
    t.includes("arşiv") ||
    t.includes("arsiv") ||
    t.includes("fotoğraf") ||
    t.includes("fotograf") ||
    tAscii.includes("fotograf") ||
    t.includes("hatıra") ||
    t.includes("hatira") ||
    t.includes("köşk") ||
    t.includes("kosk") ||
    t.includes("manastır") ||
    t.includes("manastir")
  ) {
    return {
      kategori: "Hafıza",
      neden:
        "Metin; tarih, arşiv, hatıra veya kültürel miras temasına yakın duruyor.",
    };
  }
  return {
    kategori: "Gündem",
    neden:
      "Metinde baskın alan sinyali yok; operasyonel olarak genel gündem sınıfında değerlendiriliyor.",
  };
}

function metindeCiddiZararDili(metin: string): boolean {
  const t = metin.toLowerCase();
  return (
    t.includes("hakaret") ||
    t.includes("küfür") ||
    t.includes("kufur") ||
    t.includes("tehdit")
  );
}

function kategoriUygulamaliSkorKatkisi(kategori: Category): number {
  switch (kategori) {
    case "Hafıza":
      return 15;
    case "Kültür":
      return 10;
    case "Şehir":
      return 10;
    case "Riskli":
      return -35;
    default:
      return 0;
  }
}

function tweetLinkindenKategoriOner(kaynak: string): Category {
  return akilliKategoriOneri(kaynak).kategori;
}

type PaylasimTaslagiSonucu =
  | { mod: "tweet"; tweet1: string; tweet2: string }
  | { mod: "yasak"; uyari: string };

type PaylasimCifti = readonly [string, string];

function metinIcinPaylasimTohumu(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const PAYLASIM_CIFTLERI: Record<
  Exclude<Category, "Riskli">,
  PaylasimCifti
> = {
  Gündem: [
    "Bu konu Trabzon'da neden her seferinde aynı şekilde ilerliyor?",
    "Gerçekten sorun çözülüyor mu, yoksa sadece konuşulup geçiliyor mu?",
  ],
  Trabzonspor: [
    "Bu gelişme Trabzonspor için bir kırılma noktası olabilir mi?",
    "Sizce bu karar doğru mu, yoksa risk mi?",
  ],
  Şehir: [
    "Trabzon'da şehir planlaması gerçekten doğru ilerliyor mu?",
    "Bu tür durumlar artık normal mi sayılmalı?",
  ],
  Kültür: [
    "Trabzon'da kültürel etkinlikler gerçekten yeterince değer görüyor mu?",
    "Bu şehir kültürünü koruyabiliyor mu?",
  ],
  Hafıza: [
    "Trabzon'un geçmişi bu kadar güçlüken neden yeterince konuşulmuyor?",
    "Sizce bu değerler unutuluyor mu?",
  ],
};

/**
 * 61Larus adına iki paylaşım taslağı; gönderi metnine göre sıra
 * hash ile kararlı karıştırılabilir (analiz başına aynı çift, farklı gönderilerde farklı sıra)
 */
function paylasimTaslagi61Larus(
  kategori: Category,
  tohumMetin: string,
): PaylasimTaslagiSonucu {
  if (kategori === "Riskli") {
    return { mod: "yasak", uyari: "Bu içerik paylaşım için uygun değil." };
  }
  const [a, b] = PAYLASIM_CIFTLERI[kategori];
  const ters = metinIcinPaylasimTohumu(`${tohumMetin}::${kategori}`) % 2 === 1;
  return ters
    ? { mod: "tweet", tweet1: b, tweet2: a }
    : { mod: "tweet", tweet1: a, tweet2: b };
}

function topluLinkSatirlarindanTweetOlustur(
  satirlar: string[],
): { tweets: Tweet[]; islenemeyen: number } {
  const tweets: Tweet[] = [];
  let islenemeyen = 0;
  for (const satir of satirlar) {
    if (!satir.trim()) continue;
    const handle = tweetLinkindenKullaniciAyikla(satir);
    if (!handle) {
      islenemeyen += 1;
      continue;
    }
    const kategori = tweetLinkindenKategoriOner(satir);
    tweets.push(
      yeniManuelTweetOlustur(`@${handle}`, TWEET_LINK_MOCK_METIN, kategori),
    );
  }
  return { tweets, islenemeyen };
}

function formatCount(n: number): string {
  if (n >= 1000) {
    const bin = n / 1000;
    const s =
      bin % 1 === 0
        ? String(Math.round(bin))
        : bin.toFixed(1).replace(".", ",").replace(/,0$/, "");
    return `${s} bin`;
  }
  return String(n);
}

function clampPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function categoryBadgeClass(cat: Category): string {
  const base =
    "inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  switch (cat) {
    case "Gündem":
      return `${base} bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30`;
    case "Trabzonspor":
      return `${base} bg-rose-950/80 text-rose-200 ring-1 ring-rose-600/40`;
    case "Şehir":
      return `${base} bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25`;
    case "Kültür":
      return `${base} bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25`;
    case "Hafıza":
      return `${base} bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30`;
    case "Riskli":
      return `${base} bg-red-950/60 text-red-300 ring-1 ring-red-500/40`;
    default:
      return `${base} bg-zinc-800 text-zinc-400`;
  }
}

type RecommendedAction =
  | "Yorum yaz"
  | "Sadece beğen"
  | "Takip et"
  | "Uzak dur";

type MockAnalysis = {
  suitabilityScore: number;
  riskLevel: "Düşük" | "Orta" | "Yüksek";
  recommendedAction: RecommendedAction;
  /** Metin analizine göre sınıf */
  onerilenKategori: Category;
  kategoriGerekcesi: string;
  summary: string;
  tone: string;
  engagementPotential: string;
  replySuggestions: [string, string, string];
  originalPostIdea: string;
};

function hashText(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const TONE_OPTIONS = [
  "Net, operasyon odaklı ve güven veren",
  "Tartışma açan ama okunabilir; yorum çağırıyor",
  "Teknik ve ekip içi koordinasyona uygun",
  "Uygulamalı, rehber tonunda",
] as const;

const ENGAGEMENT_OPTIONS = [
  "Güçlü — somut çıkarım ve yakalanabilir bir kanca var",
  "Yüksek — ekip ve paydaşlar için paylaşım potansiyeli iyi",
  "Çok yüksek — net görüş ifadesi yanıt trafiğini artırır",
  "Dengeli — kaydet ve tekrar bak ağırlıklı, ani viral değil",
] as const;

const REPLY_AND_IDEA_BUNDLES: {
  replies: [string, string, string];
  idea: string;
}[] = [
  {
    replies: [
      "Trabzon sahası için bu çerçeve çok yerinde. Bir sonraki adımda hangi birimi önceliklendiriyorsunuz?",
      "Panelde görev güncellemesi sonrası sahadan dönüş süresi hedefiniz nedir?",
      "Katılıyorum. Bu mesajı haftalık özet kartına da taşımayı düşünür müsünüz?",
    ],
    idea:
      "Özgün paylaşım: ‘61Larus X’te bir görevin sahaya yansıması — 3 madde: atama, teyit, kapanış’ şeklinde kısa bir gönderi zinciri.",
  },
  {
    replies: [
      "Alternatif güzergâh için trafik birimleriyle koordinasyon nasıl işliyor?",
      "14.00 buluşmasından sonra panelde hangi etiketle durum düşeceksiniz?",
      "Teşekkürler, güvenlik açısından ek not düşme şansınız olur mu?",
    ],
    idea:
      "Özgün paylaşım: ‘Festival günü: A planı / B planı — Trabzon’da sahada ne değişti?’ tek görsel + üç maddelik özet.",
  },
  {
    replies: [
      "Risk tanımına katılıyorum. Panelde ‘bekleyen teyit’ uyarısı kullanıyor musunuz?",
      "Sahadaki not gecikmesinde en sık görülen sebep sizde ne?",
      "Bu tonda yazmak dikkat ister; onay akışınız kaç adım?",
    ],
    idea:
      "Özgün paylaşım: ‘Yanlış varsayım: görünürlük = kontrol’ — bir örnek olay ve düzeltici aksiyon (61Larus süreciyle).",
  },
];

const ACTION_ORDER: RecommendedAction[] = [
  "Yorum yaz",
  "Sadece beğen",
  "Takip et",
  "Uzak dur",
];

function mockScoreRiskAction(
  category: Category,
  h: number,
  text: string,
): Pick<MockAnalysis, "suitabilityScore" | "riskLevel" | "recommendedAction"> {
  const r = h % 97;
  let pack: {
    suitabilityScore: number;
    riskLevel: MockAnalysis["riskLevel"];
    recommendedAction: RecommendedAction;
  };

  switch (category) {
    case "Riskli":
      pack = {
        suitabilityScore: clampPct(32 + (r % 18)),
        riskLevel: "Yüksek",
        recommendedAction: "Uzak dur",
      };
      break;
    case "Trabzonspor":
      pack = {
        suitabilityScore: clampPct(52 + (r % 18)),
        riskLevel: "Orta",
        recommendedAction: ACTION_ORDER[r % 2 === 0 ? 1 : 2],
      };
      break;
    case "Gündem":
      pack = {
        suitabilityScore: clampPct(66 + (r % 14)),
        riskLevel: r % 3 === 0 ? "Orta" : "Düşük",
        recommendedAction: "Yorum yaz",
      };
      break;
    case "Şehir":
      pack = {
        suitabilityScore: clampPct(60 + (r % 16)),
        riskLevel: "Düşük",
        recommendedAction: r % 4 === 0 ? "Takip et" : "Yorum yaz",
      };
      break;
    case "Kültür":
      pack = {
        suitabilityScore: clampPct(64 + (r % 12)),
        riskLevel: "Düşük",
        recommendedAction: r % 3 === 0 ? "Sadece beğen" : "Yorum yaz",
      };
      break;
    case "Hafıza":
      pack = {
        suitabilityScore: clampPct(68 + (r % 15)),
        riskLevel: "Düşük",
        recommendedAction: r % 3 === 0 ? "Takip et" : "Sadece beğen",
      };
      break;
    default:
      pack = {
        suitabilityScore: 64,
        riskLevel: "Orta",
        recommendedAction: "Yorum yaz",
      };
  }

  pack.suitabilityScore = clampPct(
    pack.suitabilityScore + kategoriUygulamaliSkorKatkisi(category),
  );

  if (metindeCiddiZararDili(text)) {
    pack.riskLevel = "Yüksek";
    pack.recommendedAction = "Uzak dur";
  }
  if (pack.riskLevel === "Yüksek") {
    pack.recommendedAction = "Uzak dur";
  }

  return pack;
}

function mockAnalyzeTweet(text: string): MockAnalysis {
  const { kategori, neden } = akilliKategoriOneri(text);
  const h = hashText(text + kategori);
  const snippet =
    text.length > 140 ? `${text.slice(0, 137).trimEnd()}…` : text.trim();
  const tone = TONE_OPTIONS[h % TONE_OPTIONS.length];
  const engagementPotential =
    ENGAGEMENT_OPTIONS[h % ENGAGEMENT_OPTIONS.length];
  const bundle = REPLY_AND_IDEA_BUNDLES[h % REPLY_AND_IDEA_BUNDLES.length];
  const { suitabilityScore, riskLevel, recommendedAction } =
    mockScoreRiskAction(kategori, h, text);

  const summary = `Gönderi şu çekirdek mesajı öne çıkarıyor: “${snippet}”. Akışta tek bakışta anlaşılır, operasyon veya saha ile ilgili paydaşlara yönelik bir özet niteliğinde.`;

  return {
    suitabilityScore,
    riskLevel,
    recommendedAction,
    onerilenKategori: kategori,
    kategoriGerekcesi: neden,
    summary,
    tone,
    engagementPotential,
    replySuggestions: bundle.replies,
    originalPostIdea: bundle.idea,
  };
}

function riskLevelBadgeClass(level: MockAnalysis["riskLevel"]): string {
  const base =
    "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums";
  switch (level) {
    case "Düşük":
      return `${base} bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25`;
    case "Orta":
      return `${base} bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30`;
    case "Yüksek":
      return `${base} bg-red-950/70 text-red-300 ring-1 ring-red-500/35`;
    default:
      return `${base} bg-zinc-800 text-zinc-300`;
  }
}

type QueueStatus = "Bekliyor" | "Yapıldı" | "Atlandı";

type QueueItem = {
  queueId: string;
  tweetId: string;
  title: string;
  shortText: string;
  category: Category;
  riskLevel: MockAnalysis["riskLevel"];
  recommendedAction: RecommendedAction;
  status: QueueStatus;
  /** Analizden gelen etkileşim metni; öncelik skorunda kullanılır */
  engagementPotential?: string;
  /** Üç yerel öneri; "Yorum yaz" öğelerinde doldurulur */
  yorumOnerileri?: [string, string, string];
  /** Düzenlenebilir 61Larus yorum taslağı */
  yorumMetni?: string;
  /** Taslağı yenile için hangi önerinin seçili olduğu (0–2) */
  taslakOneriIndeksi?: number;
};

function etkilesimPotansiyeliYuksek(metin: string | undefined): boolean {
  if (!metin) return false;
  const t = metin.trim();
  if (t.startsWith("Çok yüksek")) return true;
  if (t.startsWith("Güçlü")) return true;
  if (t.startsWith("Yüksek")) return true;
  return false;
}

type PaylasimZamanKarti = { zaman: string; gerekce: string };

type PaylasimZamanCifti = {
  tweet1: PaylasimZamanKarti;
  tweet2: PaylasimZamanKarti;
};

/**
 * Kategori ve (Gündem için) etkileşim metnine göre yerel saat/timing önerisi — kayıt yok.
 */
function paylasimZamanOneri(
  kategori: Category,
  etkilesimMetni: string,
  tohumMetin: string,
): PaylasimZamanCifti | null {
  if (kategori === "Riskli") {
    return null;
  }
  const h = (sonek: string) =>
    metinIcinPaylasimTohumu(`${tohumMetin}::${kategori}::zaman::${sonek}`);

  switch (kategori) {
    case "Gündem": {
      if (etkilesimPotansiyeliYuksek(etkilesimMetni)) {
        const v: PaylasimZamanKarti = {
          zaman: "Hemen paylaş",
          gerekce: "Gündem içerikleri bekletilirse etkisini kaybeder.",
        };
        return { tweet1: v, tweet2: v };
      }
      return {
        tweet1: {
          zaman: "1 saat içinde",
          gerekce:
            "Etkileşim sinyali orta düzeyde; kısa gecikme ikinci deneme penceresi açar.",
        },
        tweet2: {
          zaman: "Bu akşam 18:00",
          gerekce:
            "Gündem hâlâ taze iken, akşam trafiğinde tekrar öne alınabilir.",
        },
      };
    }
    case "Trabzonspor": {
      const ters = h("trab") % 2 === 1;
      const hemen: PaylasimZamanKarti = {
        zaman: "Hemen paylaş",
        gerekce: "Kulüp gündeminde hız, görünürlüğü belirler.",
      };
      const sonrasi: PaylasimZamanKarti = {
        zaman: "1 saat sonra",
        gerekce:
          "Kısa gecikmeyle tartışmalar netleşince, yorumunuz tekil kalır ve öne düşer.",
      };
      return ters
        ? { tweet1: sonrasi, tweet2: hemen }
        : { tweet1: hemen, tweet2: sonrasi };
    }
    case "Şehir": {
      const ters = h("sehir") % 2 === 1;
      const ogl: PaylasimZamanKarti = {
        zaman: "Öğlen 12:30",
        gerekce: "Belediye ve ulaşımda öğle arası ekran trafiği yüksektir.",
      };
      const aks: PaylasimZamanKarti = {
        zaman: "Akşam 20:00",
        gerekce: "Dönüş ve şehir gündeminde akşam bandı yoğun okunur.",
      };
      return ters
        ? { tweet1: aks, tweet2: ogl }
        : { tweet1: ogl, tweet2: aks };
    }
    case "Kültür": {
      const v: PaylasimZamanKarti = {
        zaman: "Akşam 20:00",
        gerekce: "Kültür içerikleri akşam daha sakin okunur.",
      };
      return { tweet1: v, tweet2: v };
    }
    case "Hafıza": {
      const ters = h("hafiza") % 2 === 1;
      const paz: PaylasimZamanKarti = {
        zaman: "Pazar 11:00",
        gerekce: "Hafıza içerikleri hafta sonu daha iyi karşılık bulur.",
      };
      const gece: PaylasimZamanKarti = {
        zaman: "Akşam 21:00",
        gerekce:
          "Hafıza metinleri sakin tonda, gece trafiğinde uzun okuma eğilimindedir.",
      };
      return ters
        ? { tweet1: gece, tweet2: paz }
        : { tweet1: paz, tweet2: gece };
    }
  }
}

function kuyrukOgesiOncelikSkoru(item: QueueItem): number {
  let s = 0;
  if (etkilesimPotansiyeliYuksek(item.engagementPotential)) s += 30;
  if (item.riskLevel === "Düşük") s += 20;
  if (item.riskLevel === "Yüksek") s -= 30;
  if (item.category === "Gündem") s += 20;
  if (item.category === "Trabzonspor") s += 15;
  if (item.category === "Riskli") s -= 20;
  if (item.recommendedAction === "Yorum yaz") s += 15;
  if (item.recommendedAction === "Takip et") s += 10;
  return Math.min(100, Math.max(0, s));
}

function shortPreview(text: string, max = 72): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function queueItemTitle(tweet: Tweet): string {
  return `${tweet.author} — @${tweet.handle}`;
}

function applyCompletedToDaily(
  action: RecommendedAction,
  prev: DailyTargetsState,
): DailyTargetsState {
  if (action === "Uzak dur") return prev;
  const next = { ...prev };
  switch (action) {
    case "Takip et":
      next.followDone = Math.min(next.followGoal, next.followDone + 1);
      break;
    case "Yorum yaz":
      next.commentDone = Math.min(next.commentGoal, next.commentDone + 1);
      break;
    case "Sadece beğen":
      next.likeDone = Math.min(next.likeGoal, next.likeDone + 1);
      break;
    default:
      break;
  }
  return next;
}

function dailyProgressFromState(d: DailyTargetsState) {
  const f = (d.followDone / d.followGoal) * 100;
  const c = (d.commentDone / d.commentGoal) * 100;
  const l = (d.likeDone / d.likeGoal) * 100;
  const total = clampPct((f + c + l) / 3);
  return {
    followPct: clampPct(f),
    commentPct: clampPct(c),
    likePct: clampPct(l),
    totalPct: total,
  };
}

function gunSonuGenelDegerlendirme(totalPct: number): string {
  if (totalPct >= 80) return "Bugün güçlü geçti.";
  if (totalPct >= 50) return "Bugün orta seviyede ilerledi.";
  return "Bugün düşük kaldı, yarın daha seçici ilerle.";
}

type DailyTargetsState = {
  followGoal: number;
  followDone: number;
  commentGoal: number;
  commentDone: number;
  likeGoal: number;
  likeDone: number;
};

const INITIAL_DAILY: DailyTargetsState = {
  followGoal: MOCK_DAILY_TARGETS.followGoal,
  followDone: MOCK_DAILY_TARGETS.followDone,
  commentGoal: MOCK_DAILY_TARGETS.commentGoal,
  commentDone: MOCK_DAILY_TARGETS.commentDone,
  likeGoal: MOCK_DAILY_TARGETS.likeGoal,
  likeDone: MOCK_DAILY_TARGETS.likeDone,
};

type OpsState = {
  daily: DailyTargetsState;
  queue: QueueItem[];
  hedefHesaplar: HedefHesap[];
};

const INITIAL_OPS: OpsState = {
  daily: INITIAL_DAILY,
  queue: [],
  hedefHesaplar: [],
};

type PaylasimSepetDurumu = "Bekliyor" | "Paylaşıldı" | "Vazgeçildi";

type PaylasimSepetOgesi = {
  id: string;
  metin: string;
  kategori: Category;
  onerilenZaman: string;
  gerekce: string;
  durum: PaylasimSepetDurumu;
};

type OperasyonArsivKaydi = {
  id: string;
  tarihSaat: string;
  takipYapilan: number;
  takipHedef: number;
  yorumYapilan: number;
  yorumHedef: number;
  begeniYapilan: number;
  begeniHedef: number;
  kuyrukBekliyor: number;
  kuyrukYapildi: number;
  kuyrukAtlandi: number;
  paylasimBekliyor: number;
  paylasimPaylasildi: number;
  paylasimVazgecildi: number;
  hedefIzlenecek: number;
  hedefTakipEdildi: number;
  hedefUzakDur: number;
  genelDegerlendirme: string;
  metinOzeti: string;
};

function sepetMetinKarsilastir(m: string): string {
  return m.trim().replace(/\s+/g, " ");
}

const YEREL_DEPOLAMA_ANAHTARI = "61larus-x-panel-v1";

type YerelDepolamaSnapshot = {
  akis: Tweet[];
  ops: OpsState;
  paylasimSepeti: PaylasimSepetOgesi[];
  operasyonArsivi: OperasyonArsivKaydi[];
};

function gunlukHedefBirlestir(
  mevcut: DailyTargetsState,
  ham: unknown,
): DailyTargetsState {
  if (!ham || typeof ham !== "object") return mevcut;
  const p = ham as Record<string, unknown>;
  const oku = (anahtar: keyof DailyTargetsState): number => {
    const v = p[anahtar];
    if (typeof v !== "number" || Number.isNaN(v) || v < 0) return mevcut[anahtar];
    return v;
  };
  return {
    followGoal: oku("followGoal"),
    followDone: oku("followDone"),
    commentGoal: oku("commentGoal"),
    commentDone: oku("commentDone"),
    likeGoal: oku("likeGoal"),
    likeDone: oku("likeDone"),
  };
}

function guvenliOpsYukle(ham: unknown): OpsState {
  if (!ham || typeof ham !== "object") {
    return { ...INITIAL_OPS };
  }
  const o = ham as Record<string, unknown>;
  return {
    daily: gunlukHedefBirlestir(INITIAL_DAILY, o.daily),
    queue: Array.isArray(o.queue) ? (o.queue as QueueItem[]) : [],
    hedefHesaplar: Array.isArray(o.hedefHesaplar) ? o.hedefHesaplar : [],
  } as OpsState;
}

function guvenliAkisYukle(ham: unknown): Tweet[] | null {
  if (!Array.isArray(ham) || ham.length === 0) return null;
  const gecerli = ham.every(
    (t) =>
      t &&
      typeof t === "object" &&
      typeof (t as Tweet).id === "string" &&
      typeof (t as Tweet).text === "string",
  );
  return gecerli ? (ham as Tweet[]) : null;
}

function guvenliPaylasimSepetYukle(ham: unknown): PaylasimSepetOgesi[] {
  if (!Array.isArray(ham)) return [];
  const out: PaylasimSepetOgesi[] = [];
  for (const el of ham) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.metin !== "string") continue;
    if (typeof o.onerilenZaman !== "string" || typeof o.gerekce !== "string")
      continue;
    if (typeof o.kategori !== "string") continue;
    if (!CATEGORIES.includes(o.kategori as Category)) continue;
    if (
      o.durum !== "Bekliyor" &&
      o.durum !== "Paylaşıldı" &&
      o.durum !== "Vazgeçildi"
    ) {
      continue;
    }
    out.push({
      id: o.id,
      metin: o.metin,
      kategori: o.kategori as Category,
      onerilenZaman: o.onerilenZaman,
      gerekce: o.gerekce,
      durum: o.durum as PaylasimSepetDurumu,
    });
  }
  return out;
}

function arsivSayiOku(v: unknown): number | null {
  if (typeof v !== "number" || Number.isNaN(v) || !Number.isFinite(v)) {
    return null;
  }
  return Math.max(0, Math.floor(v));
}

function guvenliOperasyonArsivYukle(ham: unknown): OperasyonArsivKaydi[] {
  if (!Array.isArray(ham)) return [];
  const out: OperasyonArsivKaydi[] = [];
  for (const el of ham) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id.trim()) continue;
    if (typeof o.tarihSaat !== "string") continue;
    if (typeof o.genelDegerlendirme !== "string") continue;
    if (typeof o.metinOzeti !== "string") continue;
    const takipYapilan = arsivSayiOku(o.takipYapilan);
    const takipHedef = arsivSayiOku(o.takipHedef);
    const yorumYapilan = arsivSayiOku(o.yorumYapilan);
    const yorumHedef = arsivSayiOku(o.yorumHedef);
    const begeniYapilan = arsivSayiOku(o.begeniYapilan);
    const begeniHedef = arsivSayiOku(o.begeniHedef);
    const kuyrukBekliyor = arsivSayiOku(o.kuyrukBekliyor);
    const kuyrukYapildi = arsivSayiOku(o.kuyrukYapildi);
    const kuyrukAtlandi = arsivSayiOku(o.kuyrukAtlandi);
    const paylasimBekliyor = arsivSayiOku(o.paylasimBekliyor);
    const paylasimPaylasildi = arsivSayiOku(o.paylasimPaylasildi);
    const paylasimVazgecildi = arsivSayiOku(o.paylasimVazgecildi);
    const hedefIzlenecek = arsivSayiOku(o.hedefIzlenecek);
    const hedefTakipEdildi = arsivSayiOku(o.hedefTakipEdildi);
    const hedefUzakDur = arsivSayiOku(o.hedefUzakDur);
    if (
      takipYapilan == null ||
      takipHedef == null ||
      yorumYapilan == null ||
      yorumHedef == null ||
      begeniYapilan == null ||
      begeniHedef == null ||
      kuyrukBekliyor == null ||
      kuyrukYapildi == null ||
      kuyrukAtlandi == null ||
      paylasimBekliyor == null ||
      paylasimPaylasildi == null ||
      paylasimVazgecildi == null ||
      hedefIzlenecek == null ||
      hedefTakipEdildi == null ||
      hedefUzakDur == null
    ) {
      continue;
    }
    out.push({
      id: o.id,
      tarihSaat: o.tarihSaat,
      takipYapilan,
      takipHedef,
      yorumYapilan,
      yorumHedef,
      begeniYapilan,
      begeniHedef,
      kuyrukBekliyor,
      kuyrukYapildi,
      kuyrukAtlandi,
      paylasimBekliyor,
      paylasimPaylasildi,
      paylasimVazgecildi,
      hedefIzlenecek,
      hedefTakipEdildi,
      hedefUzakDur,
      genelDegerlendirme: o.genelDegerlendirme,
      metinOzeti: o.metinOzeti,
    });
  }
  return out;
}

function arsivKisaMetrikOzeti(k: OperasyonArsivKaydi): string {
  return [
    `Takip ${k.takipYapilan}/${k.takipHedef}`,
    `Yorum ${k.yorumYapilan}/${k.yorumHedef}`,
    `Beğeni ${k.begeniYapilan}/${k.begeniHedef}`,
    `Kuyruk ${k.kuyrukBekliyor}/${k.kuyrukYapildi}/${k.kuyrukAtlandi}`,
    `Paylaşım ${k.paylasimBekliyor}/${k.paylasimPaylasildi}/${k.paylasimVazgecildi}`,
    `Hedef hesaplar ${k.hedefIzlenecek}/${k.hedefTakipEdildi}/${k.hedefUzakDur}`,
  ].join(" · ");
}

function yerelDepolamadanOku():
  | {
      akis: Tweet[] | null;
      ops: OpsState | null;
      paylasimSepeti: PaylasimSepetOgesi[] | null;
      operasyonArsivi: OperasyonArsivKaydi[];
    }
  | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(YEREL_DEPOLAMA_ANAHTARI);
    if (raw == null || raw === "") return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== "object") return null;
    const kayit = p as Record<string, unknown>;
    return {
      akis: "akis" in kayit ? guvenliAkisYukle(kayit.akis) : null,
      ops: "ops" in kayit ? guvenliOpsYukle(kayit.ops) : null,
      paylasimSepeti:
        "paylasimSepeti" in kayit
          ? guvenliPaylasimSepetYukle(kayit.paylasimSepeti)
          : null,
      operasyonArsivi:
        "operasyonArsivi" in kayit
          ? guvenliOperasyonArsivYukle(kayit.operasyonArsivi)
          : [],
    };
  } catch {
    return null;
  }
}

function yerelDepolamayaYaz(
  akis: Tweet[],
  ops: OpsState,
  paylasimSepeti: PaylasimSepetOgesi[],
  operasyonArsivi: OperasyonArsivKaydi[],
): void {
  if (typeof window === "undefined") return;
  try {
    const snapshot: YerelDepolamaSnapshot = {
      akis,
      ops,
      paylasimSepeti,
      operasyonArsivi,
    };
    localStorage.setItem(
      YEREL_DEPOLAMA_ANAHTARI,
      JSON.stringify(snapshot),
    );
  } catch {
    /* silent fail */
  }
}

function hedefHandleAnahtar(raw: string): string {
  return kullaniciAdiniNormalizeEt(raw).toLowerCase();
}

function hedefKategoriBadgeClass(k: HedefHesapKategorisi): string {
  const base =
    "inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide";
  switch (k) {
    case "Yerel medya":
      return `${base} bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/25`;
    case "Trabzonspor":
      return `${base} bg-rose-950/80 text-rose-200 ring-1 ring-rose-600/40`;
    case "Belediye":
      return `${base} bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/25`;
    case "Gazeteci":
      return `${base} bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/25`;
    case "Kültür":
      return `${base} bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/25`;
    case "Vatandaş":
      return `${base} bg-teal-500/15 text-teal-300 ring-1 ring-teal-500/25`;
    case "Riskli":
      return `${base} bg-red-950/60 text-red-300 ring-1 ring-red-500/40`;
    default:
      return `${base} bg-zinc-800 text-zinc-400`;
  }
}

function hedefDurumBadgeClass(d: HedefHesapDurumu): string {
  const base =
    "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold";
  switch (d) {
    case "İzlenecek":
      return `${base} bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30`;
    case "Takip edildi":
      return `${base} bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25`;
    case "Uzak dur":
      return `${base} bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600/40`;
    default:
      return `${base} bg-zinc-800 text-zinc-300`;
  }
}

function queueStatusBadgeClass(status: QueueStatus): string {
  const base =
    "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold";
  switch (status) {
    case "Bekliyor":
      return `${base} bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30`;
    case "Yapıldı":
      return `${base} bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25`;
    case "Atlandı":
      return `${base} bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600/40`;
    default:
      return `${base} bg-zinc-800 text-zinc-300`;
  }
}

function sepetDurumBadgeClass(d: PaylasimSepetDurumu): string {
  const base =
    "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold";
  switch (d) {
    case "Bekliyor":
      return `${base} bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30`;
    case "Paylaşıldı":
      return `${base} bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25`;
    case "Vazgeçildi":
      return `${base} bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600/40`;
    default:
      return `${base} bg-zinc-800 text-zinc-300`;
  }
}

export default function Home() {
  const [akis, setAkis] = useState<Tweet[]>(() => [...ORNEK_AKIS_TOHUMU]);
  const [selectedId, setSelectedId] = useState(
    () => ORNEK_AKIS_TOHUMU[0]?.id ?? "",
  );
  const [analysis, setAnalysis] = useState<MockAnalysis | null>(null);
  const [ops, setOps] = useState<OpsState>(INITIAL_OPS);
  const [paylasimSepeti, setPaylasimSepeti] = useState<PaylasimSepetOgesi[]>([]);
  const [sepetEklemeUyari, setSepetEklemeUyari] = useState<string | null>(null);
  const [sepetKopyaId, setSepetKopyaId] = useState<string | null>(null);
  const sepetKopyaZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sepetUyariZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [verilerYereldenHazir, setVerilerYereldenHazir] = useState(false);
  const [operasyonArsivi, setOperasyonArsivi] = useState<OperasyonArsivKaydi[]>(
    [],
  );
  const [icerikHavuzu, setIcerikHavuzu] = useState<LarusEntry[]>([]);
  const [icerikHavuzuYukleniyor, setIcerikHavuzuYukleniyor] = useState(true);
  const [icerikHavuzuHata, setIcerikHavuzuHata] = useState(false);

  useEffect(() => {
    const oku = yerelDepolamadanOku();
    if (oku) {
      if (oku.akis) {
        setAkis(oku.akis);
        setSelectedId(oku.akis[0]?.id ?? "");
      }
      if (oku.ops) {
        setOps(oku.ops);
      }
      if (oku.paylasimSepeti != null) {
        setPaylasimSepeti(oku.paylasimSepeti);
      }
      setOperasyonArsivi(oku.operasyonArsivi);
    }
    setVerilerYereldenHazir(true);
  }, []);

  useEffect(() => {
    let iptal = false;
    (async () => {
      const yerel = loadEntriesPoolFromStorage();
      if (yerel && yerel.length > 0) {
        if (!iptal) {
          setIcerikHavuzu(yerel);
          setIcerikHavuzuYukleniyor(false);
        }
        return;
      }
      setIcerikHavuzuHata(false);
      try {
        const taze = await fetchEntries();
        if (iptal) return;
        const birlesik = mergeAndNormalizePool([], taze);
        saveEntriesPoolToStorage(birlesik);
        setIcerikHavuzu(birlesik);
      } catch (e) {
        console.warn("[İçerik Havuzu] fetchEntries:", e);
        if (!iptal) setIcerikHavuzuHata(true);
      } finally {
        if (!iptal) setIcerikHavuzuYukleniyor(false);
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  useEffect(() => {
    if (!verilerYereldenHazir) return;
    yerelDepolamayaYaz(akis, ops, paylasimSepeti, operasyonArsivi);
  }, [akis, ops, paylasimSepeti, operasyonArsivi, verilerYereldenHazir]);

  const [yeniKullanici, setYeniKullanici] = useState("");
  const [yeniMetin, setYeniMetin] = useState("");
  const [yeniKategori, setYeniKategori] = useState<Category>("Gündem");
  const [tweetLinkiInput, setTweetLinkiInput] = useState("");
  const [linktenDolduruldu, setLinktenDolduruldu] = useState(false);
  const linkBilgiZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cokluLinklerMetni, setCokluLinklerMetni] = useState("");
  const [topluEkleBilgi, setTopluEkleBilgi] = useState<{
    eklenen: number;
    islenemeyen: number;
  } | null>(null);
  const topluBilgiZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hedefKullaniciInput, setHedefKullaniciInput] = useState("");
  const [hedefKategoriInput, setHedefKategoriInput] =
    useState<HedefHesapKategorisi>("Yerel medya");
  const [hedefNotInput, setHedefNotInput] = useState("");
  const [hedefUyari, setHedefUyari] = useState<string | null>(null);

  const selected =
    akis.find((t) => t.id === selectedId) ?? akis[0] ?? ORNEK_AKIS_TOHUMU[0];

  const dailyTargets = ops.daily;
  const queueItems = ops.queue;

  const siraliKuyruk = useMemo(
    () =>
      [...queueItems].sort(
        (a, b) =>
          kuyrukOgesiOncelikSkoru(b) - kuyrukOgesiOncelikSkoru(a),
      ),
    [queueItems],
  );

  const siradakiEnOnemliIs = useMemo(() => {
    const bekleyen = queueItems.filter((q) => q.status === "Bekliyor");
    if (bekleyen.length === 0) return null;
    return bekleyen.reduce((enIyi, q) =>
      kuyrukOgesiOncelikSkoru(q) > kuyrukOgesiOncelikSkoru(enIyi) ? q : enIyi,
    );
  }, [queueItems]);

  const dailyProgress = useMemo(
    () => dailyProgressFromState(ops.daily),
    [ops.daily],
  );

  const gunSonuOzeti = useMemo(() => {
    const d = ops.daily;
    const kb = ops.queue.filter((q) => q.status === "Bekliyor").length;
    const ky = ops.queue.filter((q) => q.status === "Yapıldı").length;
    const ka = ops.queue.filter((q) => q.status === "Atlandı").length;
    const sb = paylasimSepeti.filter((p) => p.durum === "Bekliyor").length;
    const sp = paylasimSepeti.filter((p) => p.durum === "Paylaşıldı").length;
    const sv = paylasimSepeti.filter((p) => p.durum === "Vazgeçildi").length;
    const hi = ops.hedefHesaplar.filter((h) => h.durum === "İzlenecek").length;
    const ht = ops.hedefHesaplar.filter((h) => h.durum === "Takip edildi").length;
    const hu = ops.hedefHesaplar.filter((h) => h.durum === "Uzak dur").length;
    const { totalPct } = dailyProgressFromState(d);
    const genel = gunSonuGenelDegerlendirme(totalPct);
    const kopyaMetni = [
      "Bugünkü 61Larus X operasyon özeti:",
      `Takip: ${d.followDone} / ${d.followGoal}`,
      `Yorum: ${d.commentDone} / ${d.commentGoal}`,
      `Beğeni: ${d.likeDone} / ${d.likeGoal}`,
      `Kuyruk: ${kb} / ${ky} / ${ka}`,
      `Paylaşım: ${sb} / ${sp} / ${sv}`,
      `Hedef hesaplar: ${hi} / ${ht} / ${hu}`,
      `Genel değerlendirme: ${genel}`,
    ].join("\n");
    return {
      kb,
      ky,
      ka,
      sb,
      sp,
      sv,
      hi,
      ht,
      hu,
      genel,
      kopyaMetni,
      totalPct,
    };
  }, [ops.daily, ops.queue, ops.hedefHesaplar, paylasimSepeti]);

  const hizliOperasyonOzeti = useMemo(() => {
    const sepetBekleyen = paylasimSepeti.filter(
      (p) => p.durum === "Bekliyor",
    ).length;
    const kuyrukBekleyen = queueItems.filter(
      (q) => q.status === "Bekliyor",
    ).length;
    return {
      sepetBekleyen,
      kuyrukBekleyen,
      hedefSayisi: ops.hedefHesaplar.length,
      sonArsivTarihi: operasyonArsivi[0]?.tarihSaat ?? null,
    };
  }, [paylasimSepeti, queueItems, ops.hedefHesaplar, operasyonArsivi]);

  const selectedInQueue = ops.queue.some((q) => q.tweetId === selected?.id);
  const seciliKuyrukOgesi = ops.queue.find((q) => q.tweetId === selected?.id);
  const yorumOnerisiEklenebilir =
    !seciliKuyrukOgesi ||
    seciliKuyrukOgesi.recommendedAction === "Yorum yaz";

  const [kopyalananQueueId, setKopyalananQueueId] = useState<string | null>(
    null,
  );
  const kopyaZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paylasimKopyaSecenek, setPaylasimKopyaSecenek] = useState<
    1 | 2 | null
  >(null);
  const paylasimKopyaZamanRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [ozetKopyalandi, setOzetKopyalandi] = useState(false);
  const ozetKopyaZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [yeniGunOnayiGoster, setYeniGunOnayiGoster] = useState(false);
  const [arsivKopyalananId, setArsivKopyalananId] = useState<string | null>(
    null,
  );
  const arsivKopyaZamanRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [accordionGunSonuAcik, setAccordionGunSonuAcik] = useState(false);
  const [accordionGecmisAcik, setAccordionGecmisAcik] = useState(false);
  const [accordionHedefAcik, setAccordionHedefAcik] = useState(false);
  const [manuelEklemeAcik, setManuelEklemeAcik] = useState(false);

  const selectTweet = (id: string) => {
    setSelectedId(id);
    setAnalysis(null);
  };

  const tweetLinkiDegisti = (v: string) => {
    setTweetLinkiInput(v);
    const handle = tweetLinkindenKullaniciAyikla(v);
    if (!handle) return;
    setYeniKullanici(`@${handle}`);
    setYeniMetin(TWEET_LINK_MOCK_METIN);
    setYeniKategori(tweetLinkindenKategoriOner(v));
    if (linkBilgiZamanRef.current) clearTimeout(linkBilgiZamanRef.current);
    setLinktenDolduruldu(true);
    linkBilgiZamanRef.current = setTimeout(() => {
      setLinktenDolduruldu(false);
      linkBilgiZamanRef.current = null;
    }, 4500);
  };

  const akisaEkle = () => {
    const handleParca = kullaniciAdiniNormalizeEt(yeniKullanici);
    const metin = yeniMetin.trim();
    if (!handleParca || !metin) return;

    const yeni = yeniManuelTweetOlustur(yeniKullanici, metin, yeniKategori);
    setAkis((onceki) => [yeni, ...onceki]);
    setSelectedId(yeni.id);
    setAnalysis(null);
    setYeniKullanici("");
    setYeniMetin("");
    setYeniKategori("Gündem");
    setTweetLinkiInput("");
    setLinktenDolduruldu(false);
    if (linkBilgiZamanRef.current) {
      clearTimeout(linkBilgiZamanRef.current);
      linkBilgiZamanRef.current = null;
    }
  };

  const topluEkleTikla = () => {
    const satirlar = cokluLinklerMetni.split(/\r?\n/);
    const { tweets, islenemeyen } = topluLinkSatirlarindanTweetOlustur(satirlar);
    if (tweets.length > 0) {
      setAkis((onceki) => [...tweets, ...onceki]);
      setSelectedId(tweets[0].id);
      setAnalysis(null);
      setCokluLinklerMetni("");
    }
    if (tweets.length > 0 || islenemeyen > 0) {
      if (topluBilgiZamanRef.current) clearTimeout(topluBilgiZamanRef.current);
      setTopluEkleBilgi({ eklenen: tweets.length, islenemeyen });
      topluBilgiZamanRef.current = setTimeout(() => {
        setTopluEkleBilgi(null);
        topluBilgiZamanRef.current = null;
      }, 5000);
    }
  };

  const enqueueFromAnalysis = (
    mode: "liste" | "yorum_taslak" | "uzak_dur",
  ) => {
    if (!selected || !analysis) return;
    const snapTweet = selected;
    const snapAnalysis = analysis;

    setOps((o) => {
      if (o.queue.some((q) => q.tweetId === snapTweet.id)) return o;

      const base: Omit<
        QueueItem,
        | "status"
        | "recommendedAction"
        | "yorumOnerileri"
        | "yorumMetni"
        | "taslakOneriIndeksi"
      > = {
        queueId: `${snapTweet.id}-${Date.now()}`,
        tweetId: snapTweet.id,
        title: queueItemTitle(snapTweet),
        shortText: shortPreview(snapTweet.text),
        category: snapAnalysis.onerilenKategori,
        riskLevel: snapAnalysis.riskLevel,
        engagementPotential: snapAnalysis.engagementPotential,
      };

      const yorumPaketi = {
        yorumOnerileri: snapAnalysis.replySuggestions,
        yorumMetni: snapAnalysis.replySuggestions[0],
        taslakOneriIndeksi: 0,
      };

      let newItem: QueueItem;
      if (mode === "uzak_dur") {
        newItem = {
          ...base,
          recommendedAction: "Uzak dur",
          status: "Atlandı",
        };
      } else if (mode === "yorum_taslak") {
        newItem = {
          ...base,
          recommendedAction: "Yorum yaz",
          status: "Bekliyor",
          ...yorumPaketi,
        };
      } else if (snapAnalysis.recommendedAction === "Yorum yaz") {
        newItem = {
          ...base,
          recommendedAction: "Yorum yaz",
          status: "Bekliyor",
          ...yorumPaketi,
        };
      } else {
        newItem = {
          ...base,
          recommendedAction: snapAnalysis.recommendedAction,
          status: "Bekliyor",
        };
      }

      return { ...o, queue: [...o.queue, newItem] };
    });
  };

  const oneriyiKuyrukYorumuYap = (oneriIndeksi: number) => {
    if (!selected || !analysis) return;
    const snapTweet = selected;
    const snapAnalysis = analysis;
    const oneriler = snapAnalysis.replySuggestions;
    const secilen = oneriler[oneriIndeksi];

    setOps((o) => {
      const mevcut = o.queue.find((q) => q.tweetId === snapTweet.id);

      if (mevcut) {
        if (mevcut.recommendedAction !== "Yorum yaz") return o;
        return {
          ...o,
          queue: o.queue.map((q) =>
            q.queueId === mevcut.queueId
              ? {
                  ...q,
                  engagementPotential: snapAnalysis.engagementPotential,
                  yorumOnerileri: oneriler,
                  yorumMetni: secilen,
                  taslakOneriIndeksi: oneriIndeksi,
                }
              : q,
          ),
        };
      }

      const base: Omit<
        QueueItem,
        | "status"
        | "recommendedAction"
        | "yorumOnerileri"
        | "yorumMetni"
        | "taslakOneriIndeksi"
      > = {
        queueId: `${snapTweet.id}-${Date.now()}`,
        tweetId: snapTweet.id,
        title: queueItemTitle(snapTweet),
        shortText: shortPreview(snapTweet.text),
        category: snapAnalysis.onerilenKategori,
        riskLevel: snapAnalysis.riskLevel,
        engagementPotential: snapAnalysis.engagementPotential,
      };

      return {
        ...o,
        queue: [
          ...o.queue,
          {
            ...base,
            recommendedAction: "Yorum yaz",
            status: "Bekliyor",
            yorumOnerileri: oneriler,
            yorumMetni: secilen,
            taslakOneriIndeksi: oneriIndeksi,
          },
        ],
      };
    });
  };

  const yorumMetniGuncelle = (queueId: string, metin: string) => {
    setOps((o) => ({
      ...o,
      queue: o.queue.map((item) =>
        item.queueId === queueId ? { ...item, yorumMetni: metin } : item,
      ),
    }));
  };

  const taslagiYenile = (queueId: string) => {
    setOps((o) => ({
      ...o,
      queue: o.queue.map((item) => {
        if (item.queueId !== queueId || !item.yorumOnerileri) return item;
        const idx = (item.taslakOneriIndeksi ?? 0) + 1;
        const nextIdx = idx % 3;
        return {
          ...item,
          taslakOneriIndeksi: nextIdx,
          yorumMetni: item.yorumOnerileri[nextIdx],
        };
      }),
    }));
  };

  const taslagiKopyala = (queueId: string, metin: string) => {
    void navigator.clipboard.writeText(metin).then(() => {
      if (kopyaZamanRef.current) clearTimeout(kopyaZamanRef.current);
      setKopyalananQueueId(queueId);
      kopyaZamanRef.current = setTimeout(() => {
        setKopyalananQueueId(null);
        kopyaZamanRef.current = null;
      }, 2000);
    });
  };

  const paylasimTaslagıKopyala = (metin: string, secenek: 1 | 2) => {
    void navigator.clipboard.writeText(metin).then(() => {
      if (paylasimKopyaZamanRef.current) {
        clearTimeout(paylasimKopyaZamanRef.current);
      }
      setPaylasimKopyaSecenek(secenek);
      paylasimKopyaZamanRef.current = setTimeout(() => {
        setPaylasimKopyaSecenek(null);
        paylasimKopyaZamanRef.current = null;
      }, 2000);
    });
  };

  const paylasimSepetineEkle = (o: {
    metin: string;
    kategori: Category;
    onerilenZaman: string;
    gerekce: string;
  }) => {
    const ana = sepetMetinKarsilastir(o.metin);
    if (!ana) return;
    if (
      paylasimSepeti.some((p) => sepetMetinKarsilastir(p.metin) === ana)
    ) {
      if (sepetUyariZamanRef.current) clearTimeout(sepetUyariZamanRef.current);
      setSepetEklemeUyari("Bu metin zaten günlük paylaşım sepetinde.");
      sepetUyariZamanRef.current = setTimeout(() => {
        setSepetEklemeUyari(null);
        sepetUyariZamanRef.current = null;
      }, 4000);
      return;
    }
    setSepetEklemeUyari(null);
    const yeni: PaylasimSepetOgesi = {
      id: `sepet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      metin: o.metin.trim(),
      kategori: o.kategori,
      onerilenZaman: o.onerilenZaman,
      gerekce: o.gerekce,
      durum: "Bekliyor",
    };
    setPaylasimSepeti((prev) => [yeni, ...prev]);
  };

  const sepettenMetinKopyala = (id: string, metin: string) => {
    void navigator.clipboard.writeText(metin).then(() => {
      if (sepetKopyaZamanRef.current) clearTimeout(sepetKopyaZamanRef.current);
      setSepetKopyaId(id);
      sepetKopyaZamanRef.current = setTimeout(() => {
        setSepetKopyaId(null);
        sepetKopyaZamanRef.current = null;
      }, 2000);
    });
  };

  const gunSonuOzetiniKopyala = () => {
    void navigator.clipboard.writeText(gunSonuOzeti.kopyaMetni).then(() => {
      if (ozetKopyaZamanRef.current) clearTimeout(ozetKopyaZamanRef.current);
      setOzetKopyalandi(true);
      ozetKopyaZamanRef.current = setTimeout(() => {
        setOzetKopyalandi(false);
        ozetKopyaZamanRef.current = null;
      }, 2000);
    });
  };

  const ozetiArsiveKaydet = () => {
    const d = ops.daily;
    const g = gunSonuOzeti;
    const simdi = new Date();
    const kayit: OperasyonArsivKaydi = {
      id: `arsiv-${simdi.getTime()}-${Math.random().toString(36).slice(2, 9)}`,
      tarihSaat: simdi.toLocaleString("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      takipYapilan: d.followDone,
      takipHedef: d.followGoal,
      yorumYapilan: d.commentDone,
      yorumHedef: d.commentGoal,
      begeniYapilan: d.likeDone,
      begeniHedef: d.likeGoal,
      kuyrukBekliyor: g.kb,
      kuyrukYapildi: g.ky,
      kuyrukAtlandi: g.ka,
      paylasimBekliyor: g.sb,
      paylasimPaylasildi: g.sp,
      paylasimVazgecildi: g.sv,
      hedefIzlenecek: g.hi,
      hedefTakipEdildi: g.ht,
      hedefUzakDur: g.hu,
      genelDegerlendirme: g.genel,
      metinOzeti: g.kopyaMetni,
    };
    setOperasyonArsivi((prev) => [kayit, ...prev]);
  };

  const arsivOzetiniKopyala = (id: string, metin: string) => {
    void navigator.clipboard.writeText(metin).then(() => {
      if (arsivKopyaZamanRef.current) clearTimeout(arsivKopyaZamanRef.current);
      setArsivKopyalananId(id);
      arsivKopyaZamanRef.current = setTimeout(() => {
        setArsivKopyalananId(null);
        arsivKopyaZamanRef.current = null;
      }, 2000);
    });
  };

  const arsivKaydiniSil = (id: string) => {
    setOperasyonArsivi((prev) => prev.filter((k) => k.id !== id));
  };

  const sepettePaylasildiVeyaVazgecti = (
    id: string,
    yeni: "Paylaşıldı" | "Vazgeçildi",
  ) => {
    setPaylasimSepeti((prev) =>
      prev.map((s) => (s.id === id && s.durum === "Bekliyor" ? { ...s, durum: yeni } : s)),
    );
  };

  const setQueueStatus = (queueId: string, status: "Yapıldı" | "Atlandı") => {
    setOps((o) => {
      const target = o.queue.find((q) => q.queueId === queueId);
      if (!target || target.status !== "Bekliyor") return o;

      const queue = o.queue.map((item) =>
        item.queueId === queueId ? { ...item, status } : item,
      );

      if (status === "Atlandı") {
        return { ...o, queue };
      }

      const daily = applyCompletedToDaily(target.recommendedAction, o.daily);
      return { ...o, daily, queue };
    });
  };

  const hedefeEkle = () => {
    const anahtar = hedefHandleAnahtar(hedefKullaniciInput);
    if (!anahtar) return;
    if (
      ops.hedefHesaplar.some((h) => hedefHandleAnahtar(h.handle) === anahtar)
    ) {
      setHedefUyari("Bu kullanıcı adı zaten hedef listede.");
      return;
    }
    setHedefUyari(null);
    const handleKayit = kullaniciAdiniNormalizeEt(hedefKullaniciInput);
    const yeni: HedefHesap = {
      id: `hedef-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      handle: handleKayit,
      kategori: hedefKategoriInput,
      not: hedefNotInput.trim(),
      durum: "İzlenecek",
    };
    setOps((o) => {
      if (
        o.hedefHesaplar.some((h) => hedefHandleAnahtar(h.handle) === anahtar)
      ) {
        return o;
      }
      return { ...o, hedefHesaplar: [yeni, ...o.hedefHesaplar] };
    });
    setHedefKullaniciInput("");
    setHedefNotInput("");
    setHedefKategoriInput("Yerel medya");
  };

  const hedefTakipEdildiIsaretle = (id: string) => {
    setOps((o) => {
      const h = o.hedefHesaplar.find((x) => x.id === id);
      if (!h || h.durum !== "İzlenecek") return o;
      const daily = {
        ...o.daily,
        followDone: Math.min(o.daily.followGoal, o.daily.followDone + 1),
      };
      return {
        ...o,
        daily,
        hedefHesaplar: o.hedefHesaplar.map((x) =>
          x.id === id ? { ...x, durum: "Takip edildi" as const } : x,
        ),
      };
    });
  };

  const hedefUzakDurIsaretle = (id: string) => {
    setOps((o) => {
      const h = o.hedefHesaplar.find((x) => x.id === id);
      if (!h || h.durum !== "İzlenecek") return o;
      return {
        ...o,
        hedefHesaplar: o.hedefHesaplar.map((x) =>
          x.id === id ? { ...x, durum: "Uzak dur" as const } : x,
        ),
      };
    });
  };

  const yeniGunuOnayla = () => {
    if (kopyaZamanRef.current) {
      clearTimeout(kopyaZamanRef.current);
      kopyaZamanRef.current = null;
    }
    if (paylasimKopyaZamanRef.current) {
      clearTimeout(paylasimKopyaZamanRef.current);
      paylasimKopyaZamanRef.current = null;
    }
    if (ozetKopyaZamanRef.current) {
      clearTimeout(ozetKopyaZamanRef.current);
      ozetKopyaZamanRef.current = null;
    }
    if (sepetKopyaZamanRef.current) {
      clearTimeout(sepetKopyaZamanRef.current);
      sepetKopyaZamanRef.current = null;
    }
    setKopyalananQueueId(null);
    setPaylasimKopyaSecenek(null);
    setOzetKopyalandi(false);
    setSepetKopyaId(null);
    setOps((o) => ({
      ...o,
      daily: {
        ...o.daily,
        followDone: 0,
        commentDone: 0,
        likeDone: 0,
      },
      queue: [],
    }));
    setPaylasimSepeti([]);
    setAnalysis(null);
    setSepetEklemeUyari(null);
    setYeniGunOnayiGoster(false);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <p className="shrink-0 border-b border-zinc-800/60 bg-zinc-950/98 px-4 py-1.5 text-center text-[10px] text-zinc-500 sm:px-6">
        Veriler bu cihazda kaydedilir
      </p>
      <header className="shrink-0 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-2.5 backdrop-blur sm:px-6 sm:py-3">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-sky-400/90">
                61Larus X Operasyon Paneli
              </p>
              <h2 className="mt-0.5 text-base font-semibold text-zinc-100">
                Bugünkü hedefler
              </h2>
              <p className="text-[11px] text-zinc-500">
                Günlük kotlar — yerel özet (örnek veri)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setYeniGunOnayiGoster(true)}
              className="rounded-lg border border-zinc-600/90 bg-zinc-800/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800/70"
            >
              Yeni günü başlat
            </button>
          </div>

          <section
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/55 p-2.5 ring-1 ring-zinc-800/40 sm:p-3"
            aria-label="Hızlı operasyon özeti"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Hızlı Operasyon Özeti
            </h3>
            <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium text-zinc-500">
                  Toplam ilerleme
                </dt>
                <dd className="text-base font-bold tabular-nums text-sky-400 sm:text-lg">
                  %{dailyProgress.totalPct}
                </dd>
              </div>
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium text-zinc-500">
                  Sepette bekleyen
                </dt>
                <dd className="tabular-nums font-semibold text-zinc-100">
                  {hizliOperasyonOzeti.sepetBekleyen}
                </dd>
              </div>
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium text-zinc-500">
                  Kuyrukta bekleyen
                </dt>
                <dd className="tabular-nums font-semibold text-zinc-100">
                  {hizliOperasyonOzeti.kuyrukBekleyen}
                </dd>
              </div>
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium text-zinc-500">
                  Hedef hesap sayısı
                </dt>
                <dd className="tabular-nums font-semibold text-zinc-100">
                  {hizliOperasyonOzeti.hedefSayisi}
                </dd>
              </div>
              <div className="rounded-md bg-zinc-950/40 px-2 py-1.5 sm:col-span-1">
                <dt className="text-[10px] font-medium text-zinc-500">
                  Son arşiv
                </dt>
                <dd className="text-xs font-medium leading-snug text-zinc-200">
                  {hizliOperasyonOzeti.sonArsivTarihi ?? "Henüz yok"}
                </dd>
              </div>
            </dl>
          </section>

          <section
            className="rounded-lg border border-zinc-800/80 bg-zinc-900/55 p-2.5 ring-1 ring-zinc-800/40 sm:p-3"
            aria-label="İçerik havuzu"
          >
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              İçerik Havuzu
            </h3>
            <p className="mt-1 text-[11px] text-zinc-500">
              61larus.com özetleri — bu cihazda{" "}
              <span className="font-mono text-zinc-400">larus_entries_pool</span>
            </p>
            {icerikHavuzuYukleniyor ? (
              <p className="mt-2 text-sm text-zinc-400">
                İçerik taranıyor…
              </p>
            ) : icerikHavuzuHata ? (
              <p className="mt-2 text-sm text-amber-300/90">
                İçerik çekilemedi. Ağ veya proxy (next rewrites) için konsolu
                kontrol edin.
              </p>
            ) : icerikHavuzu.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                Havuz boş — uygun özet bulunamadı.
              </p>
            ) : (
              <ul className="mt-2 max-h-[min(28rem,50vh)] space-y-2 overflow-y-auto pr-1">
                {icerikHavuzu.slice(0, 20).map((madde) => (
                  <li
                    key={madde.id}
                    className="rounded-md border border-zinc-800/70 bg-zinc-950/45 px-2.5 py-2"
                  >
                    <p className="text-sm font-medium leading-snug text-zinc-100">
                      {madde.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                      {contentPreview(madde.content, 160)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {yeniGunOnayiGoster ? (
            <div
              className="rounded-lg border border-amber-500/35 bg-amber-950/15 px-3 py-3 ring-1 ring-amber-500/20"
              role="dialog"
              aria-label="Yeni günü başlat onayı"
            >
              <p className="text-sm leading-relaxed text-zinc-200">
                Bugünkü sayaçlar ve günlük işler sıfırlanacak. Akış ve hedef
                hesaplar korunacak.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={yeniGunuOnayla}
                  className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25"
                >
                  Onayla
                </button>
                <button
                  type="button"
                  onClick={() => setYeniGunOnayiGoster(false)}
                  className="rounded-lg border border-zinc-600/90 bg-zinc-800/50 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Vazgeç
                </button>
              </div>
            </div>
          ) : null}

          <section
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 ring-1 ring-zinc-800/50"
            aria-label="Günlük paylaşım sepeti"
          >
            <h3 className="text-sm font-semibold text-zinc-100">
              Günlük Paylaşım Sepeti
            </h3>
            {paylasimSepeti.length === 0 ? (
              <p className="mt-1.5 text-sm text-zinc-500">
                Henüz sepete eklenen paylaşım taslağı yok.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {paylasimSepeti.map((oge) => (
                  <li
                    key={oge.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2.5"
                  >
                    <p className="text-sm leading-relaxed text-zinc-100">
                      {oge.metin}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={categoryBadgeClass(oge.kategori)}>
                        {oge.kategori}
                      </span>
                      <span className={sepetDurumBadgeClass(oge.durum)}>
                        {oge.durum}
                      </span>
                    </div>
                    <div className="mt-2 text-[11px] text-zinc-500">
                      <span className="text-zinc-600">Önerilen zaman: </span>
                      <span className="text-zinc-300">{oge.onerilenZaman}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-zinc-400">
                      <span className="text-zinc-600">Gerekçe: </span>
                      {oge.gerekce}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => sepettenMetinKopyala(oge.id, oge.metin)}
                        className="rounded-md border border-zinc-600/80 bg-zinc-800/50 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                      >
                        {sepetKopyaId === oge.id
                          ? "Kopyalandı"
                          : "Tweeti kopyala"}
                      </button>
                      {oge.durum === "Bekliyor" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              sepettePaylasildiVeyaVazgecti(oge.id, "Paylaşıldı")
                            }
                            className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                          >
                            Paylaşıldı işaretle
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              sepettePaylasildiVeyaVazgecti(oge.id, "Vazgeçildi")
                            }
                            className="rounded-md border border-zinc-600 bg-zinc-800/60 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                          >
                            Vazgeçildi
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 ring-1 ring-zinc-800/50"
            aria-label="Gün sonu özeti"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAccordionGunSonuAcik((v) => !v)}
                aria-expanded={accordionGunSonuAcik}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700/90 bg-zinc-800/60 text-xs text-zinc-400 transition hover:bg-zinc-800"
              >
                <span className="sr-only">
                  {accordionGunSonuAcik
                    ? "Gün sonu özetini daralt"
                    : "Gün sonu özetini genişlet"}
                </span>
                <span aria-hidden>{accordionGunSonuAcik ? "▼" : "▶"}</span>
              </button>
              <h3 className="min-w-0 flex-1 text-sm font-semibold text-zinc-100">
                Gün Sonu Özeti
              </h3>
              <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={ozetiArsiveKaydet}
                  className="rounded-lg border border-violet-500/40 bg-violet-500/12 px-2.5 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/22"
                >
                  Özeti arşive kaydet
                </button>
                <button
                  type="button"
                  onClick={gunSonuOzetiniKopyala}
                  className="rounded-lg border border-sky-500/45 bg-sky-500/12 px-2.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/22"
                >
                  {ozetKopyalandi ? "Kopyalandı" : "Özeti kopyala"}
                </button>
              </div>
            </div>
            {accordionGunSonuAcik ? (
            <>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Takip
                </dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">
                  {dailyTargets.followDone} / {dailyTargets.followGoal}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    (yapılan / hedef)
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Yorum
                </dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">
                  {dailyTargets.commentDone} / {dailyTargets.commentGoal}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    (yapılan / hedef)
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Beğeni
                </dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">
                  {dailyTargets.likeDone} / {dailyTargets.likeGoal}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    (yapılan / hedef)
                  </span>
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Kuyruk
                </dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">
                  {gunSonuOzeti.kb} / {gunSonuOzeti.ky} / {gunSonuOzeti.ka}
                </dd>
                <dd className="mt-1 text-[11px] text-zinc-500">
                  bekliyor / yapıldı / atlandı
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Paylaşım sepeti
                </dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">
                  {gunSonuOzeti.sb} / {gunSonuOzeti.sp} / {gunSonuOzeti.sv}
                </dd>
                <dd className="mt-1 text-[11px] text-zinc-500">
                  bekliyor / paylaşıldı / vazgeçildi
                </dd>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                  Hedef hesaplar
                </dt>
                <dd className="mt-0.5 tabular-nums text-zinc-100">
                  {gunSonuOzeti.hi} / {gunSonuOzeti.ht} / {gunSonuOzeti.hu}
                </dd>
                <dd className="mt-1 text-[11px] text-zinc-500">
                  izlenecek / takip edildi / uzak dur
                </dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg border border-zinc-800/70 bg-zinc-950/50 px-3 py-2 text-sm leading-relaxed text-zinc-200">
              <span className="text-zinc-500">Kısa yorum: </span>
              {gunSonuOzeti.genel}
            </p>
            </>
            ) : null}
          </section>

          <section
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 ring-1 ring-zinc-800/50"
            aria-label="Operasyon geçmişi"
          >
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setAccordionGecmisAcik((v) => !v)}
                aria-expanded={accordionGecmisAcik}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700/90 bg-zinc-800/60 text-xs text-zinc-400 transition hover:bg-zinc-800"
              >
                <span className="sr-only">
                  {accordionGecmisAcik
                    ? "Operasyon geçmişini daralt"
                    : "Operasyon geçmişini genişlet"}
                </span>
                <span aria-hidden>{accordionGecmisAcik ? "▼" : "▶"}</span>
              </button>
              <h3 className="min-w-0 flex-1 text-sm font-semibold text-zinc-100">
                Operasyon Geçmişi
              </h3>
              {operasyonArsivi.length > 0 ? (
                <span className="text-[11px] tabular-nums text-zinc-500">
                  {operasyonArsivi.length} kayıt
                </span>
              ) : null}
            </div>
            {accordionGecmisAcik ? (
            operasyonArsivi.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                Henüz arşivlenmiş gün sonu özeti yok. Özeti kaydetmek için
                yukarıdaki «Özeti arşive kaydet» düğmesini kullanın.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {operasyonArsivi.map((k) => (
                  <li
                    key={k.id}
                    className="rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium tabular-nums text-zinc-400">
                          {k.tarihSaat}
                        </p>
                        <p className="mt-1 text-sm font-medium text-zinc-100">
                          {k.genelDegerlendirme}
                        </p>
                        <p className="mt-1.5 text-[11px] leading-snug text-zinc-500">
                          {arsivKisaMetrikOzeti(k)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => arsivOzetiniKopyala(k.id, k.metinOzeti)}
                          className="rounded-md border border-sky-500/45 bg-sky-500/10 px-2.5 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                        >
                          {arsivKopyalananId === k.id
                            ? "Kopyalandı"
                            : "Özeti kopyala"}
                        </button>
                        <button
                          type="button"
                          onClick={() => arsivKaydiniSil(k.id)}
                          className="rounded-md border border-red-500/35 bg-red-950/30 px-2.5 py-1.5 text-xs font-medium text-red-200/95 transition hover:bg-red-950/50"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
            ) : null}
          </section>

          <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/35 p-3 ring-1 ring-zinc-800/40">
            <h3 className="text-sm font-semibold text-zinc-100">
              Yeni gönderi ekle
            </h3>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Dışarıdan kopyaladığınız gönderiyi akışa ekleyin; analiz ve kuyruk
              ile kullanılabilir.
            </p>
            <div className="mt-2.5">
              <label
                htmlFor="tweet-linki"
                className="block text-xs font-medium text-zinc-400"
              >
                Tweet linki yapıştır
              </label>
              <input
                id="tweet-linki"
                type="url"
                inputMode="url"
                value={tweetLinkiInput}
                onChange={(e) => tweetLinkiDegisti(e.target.value)}
                placeholder="https://x.com/kullaniciadi/status/…"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/35"
              />
              <p className="mt-1 text-[11px] text-zinc-600">
                X veya Twitter adresinden kullanıcı adı çıkarılır; metin ve kategori
                yerel mock ile önerilir (canlı API yok).
              </p>
              {linktenDolduruldu ? (
                <p className="mt-2 text-xs font-medium text-emerald-400/95">
                  Linkten dolduruldu
                </p>
              ) : null}
            </div>
            <div className="mt-2.5">
              <label
                htmlFor="coklu-tweet-linki"
                className="block text-xs font-medium text-zinc-400"
              >
                Birden fazla tweet linki yapıştır (her satıra bir link)
              </label>
              <textarea
                id="coklu-tweet-linki"
                value={cokluLinklerMetni}
                onChange={(e) => setCokluLinklerMetni(e.target.value)}
                rows={4}
                placeholder={
                  "https://x.com/kullanici/status/…\nhttps://x.com/baskahesap/status/…"
                }
                autoComplete="off"
                className="mt-1 w-full resize-y rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/35"
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={topluEkleTikla}
                  disabled={!cokluLinklerMetni.trim()}
                  className="rounded-lg border border-sky-500/50 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Toplu ekle
                </button>
                {topluEkleBilgi && topluEkleBilgi.eklenen > 0 ? (
                  <span className="text-xs font-medium text-emerald-400/95">
                    {topluEkleBilgi.eklenen} gönderi eklendi
                  </span>
                ) : null}
                {topluEkleBilgi && topluEkleBilgi.islenemeyen > 0 ? (
                  <span className="text-xs text-amber-400/90">
                    {topluEkleBilgi.islenemeyen} link işlenemedi
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-2.5 rounded-lg border border-zinc-800/80 bg-zinc-950/25">
              <button
                type="button"
                onClick={() => setManuelEklemeAcik((v) => !v)}
                aria-expanded={manuelEklemeAcik}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 transition hover:bg-zinc-900/40"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-700/80 bg-zinc-900/50 text-[10px] text-zinc-400"
                  aria-hidden
                >
                  {manuelEklemeAcik ? "▼" : "▶"}
                </span>
                Manuel ekleme
                <span className="text-[10px] font-normal text-zinc-500">
                  (kullanıcı adı, kategori, metin)
                </span>
              </button>
              {manuelEklemeAcik ? (
                <div className="border-t border-zinc-800/70 px-2.5 pb-2.5 pt-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
                    <div className="lg:col-span-3">
                      <label
                        htmlFor="yeni-kullanici"
                        className="block text-xs font-medium text-zinc-400"
                      >
                        Kullanıcı adı
                      </label>
                      <input
                        id="yeni-kullanici"
                        type="text"
                        value={yeniKullanici}
                        onChange={(e) => setYeniKullanici(e.target.value)}
                        placeholder="@trabzonhaber"
                        autoComplete="off"
                        className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/35"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label
                        htmlFor="yeni-kategori"
                        className="block text-xs font-medium text-zinc-400"
                      >
                        Kategori
                      </label>
                      <select
                        id="yeni-kategori"
                        value={yeniKategori}
                        onChange={(e) =>
                          setYeniKategori(e.target.value as Category)
                        }
                        className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/35"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-5">
                      <label
                        htmlFor="yeni-metin"
                        className="block text-xs font-medium text-zinc-400"
                      >
                        Gönderi metni
                      </label>
                      <textarea
                        id="yeni-metin"
                        value={yeniMetin}
                        onChange={(e) => setYeniMetin(e.target.value)}
                        rows={2}
                        placeholder="Gönderinin tam metnini yapıştırın…"
                        className="mt-1 w-full resize-y rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/35"
                      />
                    </div>
                    <div className="flex lg:col-span-2">
                      <button
                        type="button"
                        onClick={akisaEkle}
                        disabled={
                          !kullaniciAdiniNormalizeEt(yeniKullanici).length ||
                          !yeniMetin.trim().length
                        }
                        className="h-[42px] w-full rounded-lg bg-sky-500 px-4 text-sm font-semibold text-zinc-950 shadow-md shadow-sky-500/15 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Akışa ekle
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <TargetRow
              label="Takip kontrolü"
              current={dailyTargets.followDone}
              goal={dailyTargets.followGoal}
              pct={dailyProgress.followPct}
            />
            <TargetRow
              label="Yorum kontrolü"
              current={dailyTargets.commentDone}
              goal={dailyTargets.commentGoal}
              pct={dailyProgress.commentPct}
            />
            <TargetRow
              label="Beğeni kontrolü"
              current={dailyTargets.likeDone}
              goal={dailyTargets.likeGoal}
              pct={dailyProgress.likePct}
            />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="flex w-[min(100%,22rem)] shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950">
          <div className="border-b border-zinc-800/80 px-4 py-2.5">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              Akış
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500">Örnek akış</p>
          </div>
          <nav className="flex-1 overflow-y-auto">
            <ul className="divide-y divide-zinc-800/60">
              {akis.map((tweet) => {
                const active = tweet.id === selectedId;
                return (
                  <li key={tweet.id}>
                    <button
                      type="button"
                      onClick={() => selectTweet(tweet.id)}
                      className={`flex w-full flex-col gap-1.5 px-4 py-2.5 text-left transition-colors ${
                        active
                          ? "bg-zinc-900/90"
                          : "hover:bg-zinc-900/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">
                          {tweet.author}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {tweet.time}
                        </span>
                      </div>
                      <span className={categoryBadgeClass(tweet.category)}>
                        {tweet.category}
                      </span>
                      <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
                        {tweet.text}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-gradient-to-b from-zinc-900 to-zinc-950">
          <div className="border-b border-zinc-800/80 px-6 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Gönderi
            </p>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {selected ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
              <div className="flex gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/30 to-violet-600/40 text-lg font-semibold text-zinc-100 ring-1 ring-zinc-700/50"
                  aria-hidden
                >
                  {(selected.author.replace(/^@/, "").slice(0, 1) || "?").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold text-zinc-50">
                      {selected.author}
                    </span>
                    <span className="text-sm text-zinc-500">
                      @{selected.handle}
                    </span>
                    <span className="text-sm text-zinc-600">
                      · {selected.time}
                    </span>
                    <span className={categoryBadgeClass(selected.category)}>
                      {selected.category}
                    </span>
                  </div>
                  <p className="mt-4 text-[15px] leading-relaxed text-zinc-200">
                    {selected.text}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-6 text-sm text-zinc-500">
                    <span>
                      <span className="font-medium text-zinc-300">
                        {formatCount(selected.stats.replies)}
                      </span>{" "}
                      Yanıtlar
                    </span>
                    <span>
                      <span className="font-medium text-zinc-300">
                        {formatCount(selected.stats.reposts)}
                      </span>{" "}
                      Yeniden gönderiler
                    </span>
                    <span>
                      <span className="font-medium text-zinc-300">
                        {formatCount(selected.stats.likes)}
                      </span>{" "}
                      Beğeniler
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-8 pt-10">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!selected) return;
                      const a = mockAnalyzeTweet(selected.text);
                      setAnalysis(a);
                      setAkis((prev) =>
                        prev.map((t) =>
                          t.id === selected.id
                            ? { ...t, category: a.onerilenKategori }
                            : t,
                        ),
                      );
                    }}
                    className="rounded-lg bg-sky-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-sky-500/20 transition hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                  >
                    Gönderiyi analiz et
                  </button>
                  <span className="text-xs text-zinc-600">
                    Seçili gönderiyi yerel olarak analiz eder
                  </span>
                </div>

                {analysis && (
                  <section
                    className="rounded-xl border border-zinc-800/90 bg-zinc-900/60 p-5 shadow-xl shadow-black/20 ring-1 ring-zinc-800/50"
                    aria-label="Analiz sonuçları"
                  >
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-sky-400/90">
                      Yerel analiz
                    </h2>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-zinc-500">
                        Önerilen sınıf:
                      </span>
                      <span
                        className={categoryBadgeClass(
                          analysis.onerilenKategori,
                        )}
                      >
                        {analysis.onerilenKategori}
                      </span>
                    </div>
                    <dl className="mt-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 ring-1 ring-zinc-800/40">
                      <dt className="text-xs font-medium text-zinc-500">
                        Neden bu kategori?
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-zinc-200">
                        {analysis.kategoriGerekcesi}
                      </dd>
                    </dl>

                    {(() => {
                      const paylasimTaslagi = paylasimTaslagi61Larus(
                        analysis.onerilenKategori,
                        selected.text,
                      );
                      const paylasimZamanlari =
                        paylasimTaslagi.mod === "yasak"
                          ? null
                          : paylasimZamanOneri(
                              analysis.onerilenKategori,
                              analysis.engagementPotential,
                              selected.text,
                            );
                      return (
                        <div
                          className="mt-4 rounded-xl border border-violet-500/25 bg-violet-950/15 p-4 ring-1 ring-violet-500/15"
                          aria-label="61Larus paylaşım taslağı"
                        >
                          <h3 className="text-sm font-semibold text-violet-200">
                            Paylaşım taslağı
                          </h3>
                          {sepetEklemeUyari ? (
                            <p className="mt-1.5 text-xs text-amber-400/90">
                              {sepetEklemeUyari}
                            </p>
                          ) : null}
                          {paylasimTaslagi.mod === "yasak" ? (
                            <p className="mt-2 text-sm leading-snug text-amber-300/95">
                              {paylasimTaslagi.uyari}
                            </p>
                          ) : (
                            <ul className="mt-3 space-y-3">
                              <li className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-violet-300/80">
                                  Tweet 1
                                </p>
                                {paylasimZamanlari ? (
                                  <div
                                    className="mt-2 space-y-1 rounded-md border border-sky-500/20 bg-sky-950/25 px-2.5 py-2"
                                    role="status"
                                    aria-label="Önerilen paylaşım zamanı (bilgi amaçlı)"
                                  >
                                    <p className="text-[10px] font-medium text-zinc-500">
                                      Önerilen zaman
                                    </p>
                                    <p className="text-xs font-semibold text-sky-200">
                                      {paylasimZamanlari.tweet1.zaman}
                                    </p>
                                    <p className="text-[11px] leading-snug text-zinc-400">
                                      <span className="text-zinc-500">
                                        Gerekçe:{" "}
                                      </span>
                                      {paylasimZamanlari.tweet1.gerekce}
                                    </p>
                                  </div>
                                ) : null}
                                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-100">
                                  {paylasimTaslagi.tweet1}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      paylasimTaslagıKopyala(
                                        paylasimTaslagi.tweet1,
                                        1,
                                      )
                                    }
                                    className="rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
                                  >
                                    {paylasimKopyaSecenek === 1
                                      ? "Kopyalandı"
                                      : "Kopyala"}
                                  </button>
                                  {paylasimZamanlari ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        paylasimSepetineEkle({
                                          metin: paylasimTaslagi.tweet1,
                                          kategori: analysis.onerilenKategori,
                                          onerilenZaman:
                                            paylasimZamanlari.tweet1.zaman,
                                          gerekce:
                                            paylasimZamanlari.tweet1.gerekce,
                                        })
                                      }
                                      className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200/95 transition hover:bg-fuchsia-500/20"
                                    >
                                      Paylaşım sepetine ekle
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                              <li className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-violet-300/80">
                                  Tweet 2
                                </p>
                                {paylasimZamanlari ? (
                                  <div
                                    className="mt-2 space-y-1 rounded-md border border-sky-500/20 bg-sky-950/25 px-2.5 py-2"
                                    role="status"
                                    aria-label="Önerilen paylaşım zamanı (bilgi amaçlı)"
                                  >
                                    <p className="text-[10px] font-medium text-zinc-500">
                                      Önerilen zaman
                                    </p>
                                    <p className="text-xs font-semibold text-sky-200">
                                      {paylasimZamanlari.tweet2.zaman}
                                    </p>
                                    <p className="text-[11px] leading-snug text-zinc-400">
                                      <span className="text-zinc-500">
                                        Gerekçe:{" "}
                                      </span>
                                      {paylasimZamanlari.tweet2.gerekce}
                                    </p>
                                  </div>
                                ) : null}
                                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-100">
                                  {paylasimTaslagi.tweet2}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      paylasimTaslagıKopyala(
                                        paylasimTaslagi.tweet2,
                                        2,
                                      )
                                    }
                                    className="rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
                                  >
                                    {paylasimKopyaSecenek === 2
                                      ? "Kopyalandı"
                                      : "Kopyala"}
                                  </button>
                                  {paylasimZamanlari ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        paylasimSepetineEkle({
                                          metin: paylasimTaslagi.tweet2,
                                          kategori: analysis.onerilenKategori,
                                          onerilenZaman:
                                            paylasimZamanlari.tweet2.zaman,
                                          gerekce:
                                            paylasimZamanlari.tweet2.gerekce,
                                        })
                                      }
                                      className="rounded-md border border-fuchsia-500/40 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200/95 transition hover:bg-fuchsia-500/20"
                                    >
                                      Paylaşım sepetine ekle
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                            </ul>
                          )}
                        </div>
                      );
                    })()}

                    <div className="mt-4 grid gap-4 border-b border-zinc-800/80 pb-4 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">
                          61Larus için uygunluk skoru
                        </dt>
                        <dd className="mt-2 flex items-center gap-3">
                          <div
                            className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800"
                            role="presentation"
                          >
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all"
                              style={{
                                width: `${analysis.suitabilityScore}%`,
                              }}
                            />
                          </div>
                          <span className="text-lg font-bold tabular-nums text-zinc-100">
                            {analysis.suitabilityScore}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">
                          Risk seviyesi
                        </dt>
                        <dd className="mt-2">
                          <span
                            className={riskLevelBadgeClass(analysis.riskLevel)}
                          >
                            {analysis.riskLevel}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">
                          Önerilen aksiyon
                        </dt>
                        <dd className="mt-2 text-sm font-medium text-zinc-100">
                          {analysis.recommendedAction}
                        </dd>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-b border-zinc-800/80 pb-4">
                      <button
                        type="button"
                        disabled={selectedInQueue}
                        onClick={() => enqueueFromAnalysis("liste")}
                        className="rounded-lg bg-sky-500/90 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-md shadow-sky-500/15 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Kuyruğa ekle
                      </button>
                      <button
                        type="button"
                        disabled={selectedInQueue}
                        onClick={() => enqueueFromAnalysis("yorum_taslak")}
                        className="rounded-lg border border-zinc-600/80 bg-zinc-800/50 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Yorumu hazırla
                      </button>
                      <button
                        type="button"
                        disabled={selectedInQueue}
                        onClick={() => enqueueFromAnalysis("uzak_dur")}
                        className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Uzak dur olarak işaretle
                      </button>
                    </div>
                    {selectedInQueue && (
                      <p className="mt-2 text-xs text-zinc-500">
                        Bu gönderi zaten operasyon kuyruğunda.
                      </p>
                    )}

                    <dl className="mt-4 space-y-4 text-sm">
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">
                          Özet
                        </dt>
                        <dd className="mt-1 leading-relaxed text-zinc-200">
                          {analysis.summary}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">
                          Ton
                        </dt>
                        <dd className="mt-1 text-zinc-200">{analysis.tone}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">
                          Etkileşim potansiyeli
                        </dt>
                        <dd className="mt-1 text-zinc-200">
                          {analysis.engagementPotential}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">
                          Yorum önerileri
                        </dt>
                        <dd className="mt-2 space-y-3">
                          {analysis.replySuggestions.map((r, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-zinc-700/70 bg-zinc-950/50 p-3 ring-1 ring-zinc-800/50"
                            >
                              <p className="text-sm leading-relaxed text-zinc-200">
                                {r}
                              </p>
                              <button
                                type="button"
                                disabled={!yorumOnerisiEklenebilir}
                                onClick={() => oneriyiKuyrukYorumuYap(i)}
                                className="mt-3 w-full rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                              >
                                Kuyruğa yorum olarak ekle
                              </button>
                            </div>
                          ))}
                          {!yorumOnerisiEklenebilir ? (
                            <p className="text-xs text-zinc-500">
                              Bu gönderi kuyrukta ve önerilen aksiyon yorum değil;
                              önce kuyruk öğesini tamamlayın veya farklı bir gönderi
                              seçin.
                            </p>
                          ) : null}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-zinc-500">
                          Özgün paylaşım fikri
                        </dt>
                        <dd className="mt-1 leading-relaxed text-zinc-200">
                          {analysis.originalPostIdea}
                        </dd>
                      </div>
                    </dl>
                  </section>
                )}

                <SiradakiEnOnemliIsKarti oge={siradakiEnOnemliIs} />
                <OperasyonKuyrugu
                  items={siraliKuyruk}
                  onYapildi={(queueId) => setQueueStatus(queueId, "Yapıldı")}
                  onAtlandi={(queueId) => setQueueStatus(queueId, "Atlandı")}
                  onYorumMetniChange={yorumMetniGuncelle}
                  onTaslakYenile={taslagiYenile}
                  onKopyala={taslagiKopyala}
                  kopyalananQueueId={kopyalananQueueId}
                />
              </div>
            </div>
          ) : (
            <div className="shrink-0 px-6 py-6">
              <p className="text-sm text-zinc-500">Bir gönderi seçin.</p>
            </div>
          )}

          <div className="shrink-0 border-t border-zinc-800/80 bg-zinc-950/30 px-4 py-3 sm:px-6">
            <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-3 ring-1 ring-zinc-800/45">
              <button
                type="button"
                onClick={() => setAccordionHedefAcik((v) => !v)}
                aria-expanded={accordionHedefAcik}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-700/90 bg-zinc-800/60 text-xs text-zinc-400">
                  <span className="sr-only">
                    {accordionHedefAcik
                      ? "Hedef hesapları daralt"
                      : "Hedef hesapları genişlet"}
                  </span>
                  <span aria-hidden>{accordionHedefAcik ? "▼" : "▶"}</span>
                </span>
                <span className="text-sm font-semibold text-zinc-100">
                  Hedef Hesaplar
                </span>
                <span className="text-[11px] tabular-nums text-zinc-500">
                  ({ops.hedefHesaplar.length})
                </span>
              </button>
              {accordionHedefAcik ? (
                <div className="mt-3 border-t border-zinc-800/70 pt-3">
                  <HedefHesaplarBolumu
                    baslikGizle
                    hesaplar={ops.hedefHesaplar}
                    kullaniciValue={hedefKullaniciInput}
                    kategoriValue={hedefKategoriInput}
                    notValue={hedefNotInput}
                    uyari={hedefUyari}
                    onKullaniciChange={(v) => {
                      setHedefKullaniciInput(v);
                      setHedefUyari(null);
                    }}
                    onKategoriChange={setHedefKategoriInput}
                    onNotChange={setHedefNotInput}
                    onEkle={hedefeEkle}
                    ekleDevreDisi={
                      !hedefHandleAnahtar(hedefKullaniciInput).length
                    }
                    onTakipEdildi={hedefTakipEdildiIsaretle}
                    onUzakDur={hedefUzakDurIsaretle}
                  />
                </div>
              ) : null}
            </div>
          </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function HedefHesaplarBolumu({
  baslikGizle = false,
  hesaplar,
  kullaniciValue,
  kategoriValue,
  notValue,
  uyari,
  onKullaniciChange,
  onKategoriChange,
  onNotChange,
  onEkle,
  ekleDevreDisi,
  onTakipEdildi,
  onUzakDur,
}: {
  baslikGizle?: boolean;
  hesaplar: HedefHesap[];
  kullaniciValue: string;
  kategoriValue: HedefHesapKategorisi;
  notValue: string;
  uyari: string | null;
  onKullaniciChange: (v: string) => void;
  onKategoriChange: (v: HedefHesapKategorisi) => void;
  onNotChange: (v: string) => void;
  onEkle: () => void;
  ekleDevreDisi: boolean;
  onTakipEdildi: (id: string) => void;
  onUzakDur: (id: string) => void;
}) {
  return (
    <section
      className={
        baslikGizle
          ? "space-y-3"
          : "rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-5 ring-1 ring-zinc-800/45"
      }
      aria-label="Hedef hesaplar"
    >
      {!baslikGizle ? (
        <>
          <h2 className="text-sm font-semibold text-zinc-100">
            Hedef Hesaplar
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            61Larus için takip edilecek ve izlenecek hesaplar.{" "}
            <span className="text-zinc-600">
              Takip edildi işaretle, üstteki takip kotasına +1 eklenir (tavan
              20).
            </span>
          </p>
        </>
      ) : (
        <p className="text-xs text-zinc-500">
          61Larus için takip edilecek ve izlenecek hesaplar.{" "}
          <span className="text-zinc-600">
            Takip edildi işaretle, üstteki takip kotasına +1 eklenir (tavan 20).
          </span>
        </p>
      )}

      <div
        className={`grid sm:grid-cols-2 lg:grid-cols-12 lg:items-end ${baslikGizle ? "gap-2" : "mt-4 gap-3"}`}
      >
        <div className="lg:col-span-3">
          <label
            htmlFor="hedef-kullanici"
            className="block text-xs font-medium text-zinc-400"
          >
            Kullanıcı adı
          </label>
          <input
            id="hedef-kullanici"
            type="text"
            value={kullaniciValue}
            onChange={(e) => onKullaniciChange(e.target.value)}
            placeholder="@ornekhesap"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/35"
          />
        </div>
        <div className="lg:col-span-3">
          <label
            htmlFor="hedef-kategori"
            className="block text-xs font-medium text-zinc-400"
          >
            Kategori
          </label>
          <select
            id="hedef-kategori"
            value={kategoriValue}
            onChange={(e) =>
              onKategoriChange(e.target.value as HedefHesapKategorisi)
            }
            className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/35"
          >
            {HEDEF_HESAP_KATEGORILERI.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-4">
          <label
            htmlFor="hedef-not"
            className="block text-xs font-medium text-zinc-400"
          >
            Not
          </label>
          <input
            id="hedef-not"
            type="text"
            value={notValue}
            onChange={(e) => onNotChange(e.target.value)}
            placeholder="Kısa not (isteğe bağlı)"
            className="mt-1 w-full rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/35"
          />
        </div>
        <div className="flex lg:col-span-2">
          <button
            type="button"
            onClick={onEkle}
            disabled={ekleDevreDisi}
            className="h-[42px] w-full rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/15 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Hedefe ekle
          </button>
        </div>
      </div>
      {uyari ? (
        <p className="mt-2 text-xs text-amber-400/90">{uyari}</p>
      ) : null}

      {hesaplar.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          Henüz hedef hesap yok. Yukarıdan ekleyin.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {hesaplar.map((h) => (
            <li
              key={h.id}
              className="rounded-lg border border-zinc-800/80 bg-zinc-950/45 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-mono text-sm font-semibold text-sky-300">
                    @{h.handle}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={hedefKategoriBadgeClass(h.kategori)}>
                      {h.kategori}
                    </span>
                    <span className={hedefDurumBadgeClass(h.durum)}>
                      {h.durum}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    <span className="text-zinc-600">Not: </span>
                    <span className="text-zinc-300">
                      {h.not.trim() ? h.not : "—"}
                    </span>
                  </p>
                </div>
                {h.durum === "İzlenecek" ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => onTakipEdildi(h.id)}
                      className="rounded-md bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Takip edildi işaretle
                    </button>
                    <button
                      type="button"
                      onClick={() => onUzakDur(h.id)}
                      className="rounded-md border border-zinc-600 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                    >
                      Uzak dur
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SiradakiEnOnemliIsKarti({ oge }: { oge: QueueItem | null }) {
  return (
    <section
      className="mb-6 rounded-xl border border-amber-500/25 bg-amber-950/20 p-4 ring-1 ring-amber-500/20"
      aria-label="Sıradaki en önemli iş"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
        Sıradaki en önemli iş
      </h3>
      {oge ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-100">{oge.title}</p>
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-sm font-bold tabular-nums text-amber-200 ring-1 ring-amber-500/30">
              Öncelik: {kuyrukOgesiOncelikSkoru(oge)}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-zinc-400">{oge.shortText}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className={categoryBadgeClass(oge.category)}>{oge.category}</span>
            <span className="text-xs text-zinc-500">
              Önerilen aksiyon:{" "}
              <span className="font-medium text-zinc-300">
                {oge.recommendedAction}
              </span>
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">
          Bekleyen kuyruk öğesi yok veya tümü tamamlandı.
        </p>
      )}
    </section>
  );
}

function OperasyonKuyrugu({
  items,
  onYapildi,
  onAtlandi,
  onYorumMetniChange,
  onTaslakYenile,
  onKopyala,
  kopyalananQueueId,
}: {
  items: QueueItem[];
  onYapildi: (queueId: string) => void;
  onAtlandi: (queueId: string) => void;
  onYorumMetniChange: (queueId: string, metin: string) => void;
  onTaslakYenile: (queueId: string) => void;
  onKopyala: (queueId: string, metin: string) => void;
  kopyalananQueueId: string | null;
}) {
  return (
    <section
      className="rounded-xl border border-zinc-800/90 bg-zinc-950/40 p-5 ring-1 ring-zinc-800/40"
      aria-label="Operasyon kuyruğu"
    >
      <h2 className="text-sm font-semibold text-zinc-100">Operasyon Kuyruğu</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Günlük iş listesi — öncelik skoruna göre sıralı; tamamlanınca üstteki
        hedef sayaçları güncellenir
      </p>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">
          Kuyruk boş. Önce gönderiyi analiz edin, ardından öğe ekleyin.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.queueId}
              className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">
                      {item.title}
                    </p>
                    <span className="shrink-0 rounded-md bg-zinc-800/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-200/95 ring-1 ring-zinc-700/80">
                      Öncelik: {kuyrukOgesiOncelikSkoru(item)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-400">
                    {item.shortText}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={categoryBadgeClass(item.category)}>
                      {item.category}
                    </span>
                    <span className={riskLevelBadgeClass(item.riskLevel)}>
                      {item.riskLevel}
                    </span>
                    <span className={queueStatusBadgeClass(item.status)}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    <span className="text-zinc-600">Önerilen aksiyon: </span>
                    <span className="font-medium text-zinc-300">
                      {item.recommendedAction}
                    </span>
                  </p>
                  {item.recommendedAction === "Yorum yaz" &&
                  item.status === "Bekliyor" ? (
                    <div className="rounded-lg border border-zinc-700/70 bg-zinc-950/55 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-sky-400/90">
                          Yorum taslağı editörü
                        </p>
                        {item.yorumOnerileri ? (
                          <span className="text-[10px] text-zinc-500">
                            Öneri{" "}
                            {(item.taslakOneriIndeksi ?? 0) + 1} / 3
                          </span>
                        ) : null}
                      </div>
                      <label htmlFor={`yorum-${item.queueId}`} className="sr-only">
                        61Larus yorum taslağı
                      </label>
                      <textarea
                        id={`yorum-${item.queueId}`}
                        value={item.yorumMetni ?? ""}
                        onChange={(e) =>
                          onYorumMetniChange(item.queueId, e.target.value)
                        }
                        rows={4}
                        className="mt-2 w-full resize-y rounded-md border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
                        placeholder="61Larus adına kullanılacak yorumu burada düzenleyin…"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onKopyala(item.queueId, item.yorumMetni ?? "")
                          }
                          className="rounded-md border border-zinc-600 bg-zinc-800/70 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                        >
                          {kopyalananQueueId === item.queueId
                            ? "Kopyalandı"
                            : "Kopyala"}
                        </button>
                        <button
                          type="button"
                          disabled={!item.yorumOnerileri}
                          onClick={() => onTaslakYenile(item.queueId)}
                          className="rounded-md border border-zinc-600 bg-zinc-800/40 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800/70 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Taslağı yenile
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {item.status === "Bekliyor" ? (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => onYapildi(item.queueId)}
                      className="rounded-md bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
                    >
                      Yapıldı
                    </button>
                    <button
                      type="button"
                      onClick={() => onAtlandi(item.queueId)}
                      className="rounded-md border border-zinc-600 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800"
                    >
                      Atlandı
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TargetRow({
  label,
  current,
  goal,
  pct,
}: {
  label: string;
  current: number;
  goal: number;
  pct: number;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        <span className="text-xs tabular-nums text-zinc-500">
          {current} / {goal}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"
        role="presentation"
      >
        <div
          className="h-full rounded-full bg-sky-500/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

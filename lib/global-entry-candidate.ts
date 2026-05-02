export type GlobalCandidateLevel = "strong" | "medium" | "weak" | "not_eligible";

export type GlobalCandidateReason =
  | "trabzon_specific"
  | "historical_or_academic_value"
  | "city_memory_value"
  | "evergreen_topic"
  | "not_too_short"
  | "not_generic"
  | "not_duplicate_like"
  | "international_reader_value";

export type GlobalCandidateAssessment = {
  level: GlobalCandidateLevel;
  score: number;
  reasons: GlobalCandidateReason[];
  notes: string[];
};

export type GlobalEntryCandidateInput = {
  title: string;
  content?: string | null;
};

function foldAsciiLower(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/\u0131/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â|ä|à|á|å|ă|ą/g, "a")
    .replace(/ê|ë|è|é|ĕ/g, "e")
    .replace(/î|ï|í|ì|ī/g, "i")
    .replace(/ô|õ|ò|ó|ō/g, "o")
    .replace(/û|ù|ú|ū/g, "u")
    .replace(/[''`´]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForPhrase(s: string): string {
  return foldAsciiLower(s);
}

/** Kelime eşlemesi için; `of`, `sel` vb. yanlış alt-dize eşleşmesini önlemek için. */
function tokensFromFolded(fold: string): Set<string> {
  const tokens = fold
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
  return new Set(tokens);
}

function foldedContainsPhrase(body: string, phrase: string): boolean {
  return body.includes(normalizeForPhrase(phrase));
}

const KARADENIZ_TOKEN = foldAsciiLower("karadeniz");

/** Trabzon / Doğu Karadeniz / ilçe / Sümela–Ayasofya–Boztepe vb.; tek başına "karadeniz" hariç. */
function hasStrongLocalPlaceSignal(
  bodyFold: string,
  tokens: Set<string>
): boolean {
  for (const ph of TRABZON_PHRASES_FOLDED) {
    if (bodyFold.includes(ph)) return true;
  }
  if (tokens.has("trabzon") || tokens.has("trabzonda")) return true;
  for (const w of TRABZON_TOKENS) {
    if (w === KARADENIZ_TOKEN) continue;
    if (tokens.has(w)) return true;
  }
  return false;
}

/** Trabzon + ilçeler; fold edilmiş küçük token veya iki kelimeli ifade. */
const TRABZON_PHRASES_FOLDED: string[] = [
  normalizeForPhrase("doğu karadeniz"),
];

const TRABZON_TOKENS = new Set(
  (
    [
      "trabzon",
      "trabzonda",
      "karadeniz",
      "sumela",
      "ayasofya",
      "boztepe",
      "of",
      "surmene",
      "akcaabat",
      "vakfikebir",
      "caykara",
      "macka",
      "ortahisar",
      "arakli",
      "tonya",
      "salpazari",
      "besikduzu",
      "yomra",
      "hayrat",
    ] as const
  ).map((w) => foldAsciiLower(w))
);

/** Akademik/tarihsel küme (+ çok kelimeli giriş). */
const ACADEMIC_PHRASES_FOLDED: string[] = [
  normalizeForPhrase("şehir hafızası"),
];

const ACADEMIC_TOKENS = new Set(
  (
    [
      "osmanli",
      "cumhuriyet",
      "tarih",
      "demografi",
      "goc",
      "siyaset",
      "ekonomi",
      "kultur",
      "afet",
      "heyelan",
      "ticaret",
      "liman",
      "toplumsal",
      "sosyolojik",
      "sel",
    ] as const
  ).map((w) => foldAsciiLower(w))
);

/** Şehir hafızası teması: "mahalle" / "yerel" yalnız başına sayılmaz. */
const CITY_MEMORY_PHRASES_FOLDED: string[] = [
  normalizeForPhrase("gündelik hayat"),
  normalizeForPhrase("şehir hafızası"),
  normalizeForPhrase("kent hafızası"),
];

const CITY_MEMORY_WORD_TOKENS = new Set(
  (["kimlik", "aidiyet", "gelenek"] as const).map((w) => foldAsciiLower(w))
);

const EVERGREEN_BLOCK_PHRASES_FOLDED: string[] = [
  normalizeForPhrase("bugün"),
  normalizeForPhrase("dün"),
  normalizeForPhrase("son dakika"),
  normalizeForPhrase("hafta sonu"),
];

const GENERIC_TITLE_TOKENS = new Set([
  "nedir",
  "nasil",
  "neden",
  "guzel",
  "hakkinda",
  "yorum",
  "tavsiye",
]);

function hasCityMemoryLinguistic(bodyFold: string, tokens: Set<string>): boolean {
  for (const ph of CITY_MEMORY_PHRASES_FOLDED) {
    if (bodyFold.includes(ph)) return true;
  }
  for (const w of CITY_MEMORY_WORD_TOKENS) {
    if (tokens.has(w)) return true;
  }
  if (bodyFold.includes("hafiza")) return true;
  return false;
}

export function evaluateGlobalEntryCandidate(
  input: GlobalEntryCandidateInput
): GlobalCandidateAssessment {
  const titleRaw = typeof input.title === "string" ? input.title : "";
  const contentRaw =
    typeof input.content === "string" && input.content.length > 0
      ? input.content
      : "";

  const contentTrimmed = contentRaw.trim();

  const combinedRaw = `${titleRaw.trim()} ${contentTrimmed}`.trim();
  if (contentTrimmed.length === 0 || combinedRaw.length < 120) {
    return {
      level: "not_eligible",
      score: 0,
      reasons: [],
      notes: ["Content is too short for global rewriting."],
    };
  }

  const bodyFold = foldAsciiLower(combinedRaw);
  const titleFold = foldAsciiLower(titleRaw.trim());
  const tokens = tokensFromFolded(bodyFold);
  const reasons: GlobalCandidateReason[] = [];
  const notes: string[] = [];

  let score = 0;

  let trabzonMatched = false;
  for (const ph of TRABZON_PHRASES_FOLDED) {
    if (bodyFold.includes(ph)) {
      trabzonMatched = true;
      break;
    }
  }
  if (!trabzonMatched) {
    for (const w of TRABZON_TOKENS) {
      if (tokens.has(w)) {
        trabzonMatched = true;
        break;
      }
    }
  }
  if (trabzonMatched) {
    score += 25;
    reasons.push("trabzon_specific");
  }

  let academicMatched = false;
  for (const ph of ACADEMIC_PHRASES_FOLDED) {
    if (bodyFold.includes(ph)) {
      academicMatched = true;
      break;
    }
  }
  if (!academicMatched) {
    const titleToks = tokensFromFolded(titleFold);
    for (const w of ACADEMIC_TOKENS) {
      if (tokens.has(w) || titleToks.has(w)) {
        academicMatched = true;
        break;
      }
    }
  }
  if (academicMatched) {
    score += 25;
    reasons.push("historical_or_academic_value");
  }

  const strongPlace = hasStrongLocalPlaceSignal(bodyFold, tokens);
  const cityMemoryLinguistic = hasCityMemoryLinguistic(bodyFold, tokens);
  const eligibleCityMemory =
    cityMemoryLinguistic && strongPlace;

  if (eligibleCityMemory) {
    score += 15;
    reasons.push("city_memory_value");
  }

  let blocksEvergreen = false;
  for (const ph of EVERGREEN_BLOCK_PHRASES_FOLDED) {
    if (bodyFold.includes(ph)) {
      blocksEvergreen = true;
      break;
    }
  }
  if (!blocksEvergreen) {
    score += 10;
    reasons.push("evergreen_topic");
  }

  const notGeneric = strongPlace;
  if (notGeneric) {
    score += 10;
    reasons.push("not_generic");
  } else {
    notes.push("Topic may be too generic for global publication.");
  }

  const internationalEligible = academicMatched || eligibleCityMemory;
  if (internationalEligible) {
    score += 10;
    reasons.push("international_reader_value");
  }

  const titleWordSet = tokensFromFolded(titleFold);
  let titlePenaltyHits = false;
  for (const w of GENERIC_TITLE_TOKENS) {
    if (titleWordSet.has(w)) {
      titlePenaltyHits = true;
      break;
    }
  }
  if (!titlePenaltyHits && foldedContainsPhrase(titleFold, "en iyi")) {
    titlePenaltyHits = true;
  }
  if (titlePenaltyHits) {
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  let level: GlobalCandidateLevel;
  if (score >= 75) level = "strong";
  else if (score >= 50) level = "medium";
  else if (score >= 25) level = "weak";
  else level = "not_eligible";

  if (level !== "not_eligible") {
    reasons.push("not_duplicate_like");
  }

  return { level, score, reasons, notes };
}

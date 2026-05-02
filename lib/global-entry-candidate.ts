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

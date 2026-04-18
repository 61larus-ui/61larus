import { SILINMIS_KULLANICI_LABEL } from "@/lib/deleted-user-label";

export type DisplayNameModePref = "nickname" | "real_name" | null | undefined;

/** Combined `first_name` + `last_name` as used for profile / comments. */
export function combinedFullNameFromParts(
  first: string | null | undefined,
  last: string | null | undefined
): string | null {
  const fn = typeof first === "string" ? first.trim() : "";
  const ln = typeof last === "string" ? last.trim() : "";
  const combined = [fn, ln].filter(Boolean).join(" ").trim();
  return combined.length > 0 ? combined : null;
}

export function isAnonymizedProfileFullName(fullName: string | null | undefined): boolean {
  return (fullName?.trim() ?? "") === SILINMIS_KULLANICI_LABEL;
}

/**
 * Single rule for header, comment authors, and any saved-profile surface:
 * anonymized → silinmiş kullanıcı; else nickname mode + nickname → nickname;
 * else full_name; else email local-part; else "Kullanıcı".
 * Does not use OAuth display names — only saved row + email fallback.
 */
export function resolveVisibleName(params: {
  fullName: string | null | undefined;
  nickname: string | null | undefined;
  displayMode: DisplayNameModePref;
  emailFallback: string | null | undefined;
}): string {
  const full = params.fullName?.trim() ?? "";
  const nick = params.nickname?.trim() ?? "";

  if (isAnonymizedProfileFullName(full)) {
    return SILINMIS_KULLANICI_LABEL;
  }

  if (params.displayMode === "nickname" && nick.length > 0) {
    return nick;
  }

  if (full.length > 0) {
    return full;
  }

  const local = params.emailFallback?.split("@")[0]?.trim();
  if (local) return local;

  return "Kullanıcı";
}

/** Lightweight completion: full name + valid mode; nickname required iff mode nickname. Avatar optional. */
export function isLightweightProfileIncomplete(
  fullName: string | null | undefined,
  nickname: string | null | undefined,
  displayMode: DisplayNameModePref
): boolean {
  const full = fullName?.trim() ?? "";
  const nick = nickname?.trim() ?? "";
  if (!full || isAnonymizedProfileFullName(full)) return true;
  if (displayMode !== "nickname" && displayMode !== "real_name") return true;
  if (displayMode === "nickname" && !nick) return true;
  return false;
}

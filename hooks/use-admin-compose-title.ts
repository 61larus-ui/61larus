"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateTitleQuality } from "@/lib/entry-title-rules";
import { DUPLICATE_TITLE_MESSAGE } from "@/lib/entry-title-similarity";

const SIMILARITY_DEBOUNCE_MS = 300;

export type ComposeTitleValidation =
  | { phase: "valid" }
  | { phase: "blocked"; message: string }
  | { phase: "checking" }
  | { phase: "warning"; message: string };

function validationFromQuality(raw: string): ComposeTitleValidation {
  const message = validateTitleQuality(raw);
  return message ? { phase: "blocked", message } : { phase: "checking" };
}

export const COMPOSE_TITLE_CHECKING_LABEL = "Başlık kontrol ediliyor…";

export const COMPOSE_TITLE_SIMILARITY_WARNING =
  "Benzer bir başlık var. Gündem içeriklerinde yine de yayınlayabilirsin.";

export type UseAdminComposeTitleOptions = {
  publishSection: string;
};

export function useAdminComposeTitle({
  publishSection,
}: UseAdminComposeTitleOptions) {
  const [draftTitle, setDraftTitle] = useState("");
  const [validation, setValidation] = useState<ComposeTitleValidation>(() =>
    validationFromQuality("")
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);
  const publishSectionRef = useRef(publishSection);
  const similarityConflictRef = useRef(false);

  publishSectionRef.current = publishSection;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!similarityConflictRef.current) return;
    if (publishSection === "today") {
      setValidation({
        phase: "warning",
        message: COMPOSE_TITLE_SIMILARITY_WARNING,
      });
    } else {
      setValidation({
        phase: "blocked",
        message: DUPLICATE_TITLE_MESSAGE,
      });
    }
  }, [publishSection]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    seqRef.current += 1;
    similarityConflictRef.current = false;
    setDraftTitle("");
    setValidation(validationFromQuality(""));
  }, []);

  const onTitleChange = useCallback((raw: string) => {
    setDraftTitle(raw);

    const message = validateTitleQuality(raw);
    if (message) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      seqRef.current += 1;
      similarityConflictRef.current = false;
      setValidation({ phase: "blocked", message });
      return;
    }

    similarityConflictRef.current = false;
    setValidation({ phase: "checking" });

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const seqAtSchedule = ++seqRef.current;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const trimmed = raw.trim();
      if (!trimmed) {
        if (seqAtSchedule === seqRef.current) {
          similarityConflictRef.current = false;
          setValidation(validationFromQuality(raw));
        }
        return;
      }

      void (async () => {
        try {
          const res = await fetch("/api/admin/check-title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ title: trimmed }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            tooSimilar?: boolean;
          };

          if (seqAtSchedule !== seqRef.current) return;

          if (!res.ok) {
            similarityConflictRef.current = false;
            setValidation({
              phase: "blocked",
              message: data.error ?? "Başlık kontrolü yapılamadı.",
            });
            return;
          }

          if (data.tooSimilar) {
            similarityConflictRef.current = true;
            const section = publishSectionRef.current;
            if (section === "today") {
              setValidation({
                phase: "warning",
                message: COMPOSE_TITLE_SIMILARITY_WARNING,
              });
            } else {
              setValidation({
                phase: "blocked",
                message: DUPLICATE_TITLE_MESSAGE,
              });
            }
          } else {
            similarityConflictRef.current = false;
            setValidation({ phase: "valid" });
          }
        } catch {
          if (seqAtSchedule !== seqRef.current) return;
          similarityConflictRef.current = false;
          setValidation({
            phase: "blocked",
            message: "Başlık kontrolü yapılamadı.",
          });
        }
      })();
    }, SIMILARITY_DEBOUNCE_MS);
  }, []);

  const canPublish =
    validation.phase === "valid" || validation.phase === "warning";

  return {
    draftTitle,
    onTitleChange,
    reset,
    validation,
    canPublish,
  };
}

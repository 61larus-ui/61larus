"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateTitleQuality } from "@/lib/entry-title-rules";

const SIMILARITY_DEBOUNCE_MS = 300;

export type ComposeTitleValidation =
  | { phase: "valid" }
  | { phase: "blocked"; message: string }
  | { phase: "checking" }
  | { phase: "warning"; message: string };

const TITLE_REQUIRED_MESSAGE = "Başlık gerekli.";

function validationFromQuality(raw: string): ComposeTitleValidation {
  if (!raw.trim()) {
    return { phase: "blocked", message: TITLE_REQUIRED_MESSAGE };
  }
  const message = validateTitleQuality(raw);
  return message ? { phase: "blocked", message } : { phase: "checking" };
}

export const COMPOSE_TITLE_CHECKING_LABEL = "Başlık kontrol ediliyor…";

export const COMPOSE_TITLE_SIMILARITY_WARNING =
  "Benzer bir başlık var. İstersen yine de devam edebilirsin.";

export function useAdminComposeTitle() {
  const [draftTitle, setDraftTitle] = useState("");
  const [validation, setValidation] = useState<ComposeTitleValidation>(() =>
    validationFromQuality("")
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    seqRef.current += 1;
    setDraftTitle("");
    setValidation(validationFromQuality(""));
  }, []);

  const onTitleChange = useCallback((raw: string) => {
    setDraftTitle(raw);

    if (!raw.trim()) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      seqRef.current += 1;
      setValidation({
        phase: "blocked",
        message: TITLE_REQUIRED_MESSAGE,
      });
      return;
    }

    const message = validateTitleQuality(raw);
    if (message) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      seqRef.current += 1;
      setValidation({ phase: "blocked", message });
      return;
    }

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
            setValidation({
              phase: "blocked",
              message: data.error ?? "Başlık kontrolü yapılamadı.",
            });
            return;
          }

          if (data.tooSimilar) {
            setValidation({
              phase: "warning",
              message: COMPOSE_TITLE_SIMILARITY_WARNING,
            });
          } else {
            setValidation({ phase: "valid" });
          }
        } catch {
          if (seqAtSchedule !== seqRef.current) return;
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

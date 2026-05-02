"use client";

import { useCallback, useState } from "react";
import { validateTitleQuality } from "@/lib/entry-title-rules";

export type ComposeTitleValidation =
  | { phase: "valid" }
  | { phase: "blocked"; message: string };

const TITLE_REQUIRED_MESSAGE = "Başlık gerekli.";

function validationFromQuality(raw: string): ComposeTitleValidation {
  if (!raw.trim()) {
    return { phase: "blocked", message: TITLE_REQUIRED_MESSAGE };
  }
  const message = validateTitleQuality(raw);
  return message ? { phase: "blocked", message } : { phase: "valid" };
}

export function useAdminComposeTitle() {
  const [draftTitle, setDraftTitle] = useState("");
  const [validation, setValidation] = useState<ComposeTitleValidation>(() =>
    validationFromQuality(""),
  );

  const reset = useCallback(() => {
    setDraftTitle("");
    setValidation(validationFromQuality(""));
  }, []);

  const onTitleChange = useCallback((raw: string) => {
    setDraftTitle(raw);
    setValidation(validationFromQuality(raw));
  }, []);

  const canPublish = validation.phase === "valid";

  return {
    draftTitle,
    onTitleChange,
    reset,
    validation,
    canPublish,
  };
}

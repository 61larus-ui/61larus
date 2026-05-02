# 61Larus Global Translation Engine Plan

## Core Principle

- Turkish entry is always the source of truth.
- English text is not a direct machine translation.
- English version is rewritten for international readers.
- Weak or generic entries are never opened to Google.
- English pages remain noindex until approved.

## Current State

- i18n foundation exists.
- Homepage/card/header labels are partially wired.
- Global candidate evaluator exists.
- Admin badges and filters exist.
- No English public pages exist yet.
- No database write exists yet.

## Future Database Columns

Önerilen kolonlar:

- `title_en` text nullable
- `content_en` text nullable
- `slug_en` text nullable
- `global_translation_status` text default `'none'`  
  values: `none` | `candidate` | `draft` | `review` | `approved` | `rejected`
- `global_translation_quality_score` integer nullable
- `global_noindex` boolean default true
- `global_approved_at` timestamptz nullable
- `global_updated_at` timestamptz nullable

## Quality Rules

- Only strong candidates can move automatically to candidate status.
- Medium candidates require manual strengthening.
- Weak and not_eligible stay Turkish-only.
- Approved English content must be rewritten, not literal translation.
- English content must preserve academic credibility and Trabzon-specific context.

## SEO Rules

- English pages are noindex until approved.
- Approved English pages can appear in sitemap.
- Turkish canonical remains separate.
- English canonical uses `/en/...` structure.
- hreflang connects tr and en variants only when English is approved.

## Admin Workflow

1. Entry gets evaluated.
2. Strong entries can be marked as global candidate.
3. English draft is generated or written.
4. Draft is reviewed.
5. If approved, noindex becomes false.
6. Page becomes eligible for sitemap and hreflang.

## Safety Notes

- Do not auto-publish English content.
- Do not index low-quality translated pages.
- Do not bulk translate all entries.
- Do not expose draft English pages to Google.

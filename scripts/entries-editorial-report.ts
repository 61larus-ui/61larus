/**
 * Read-only: loads public.entries and prints an editorial duplicate / quality report.
 * Does not delete or update any data.
 */
import { writeFileSync } from "node:fs"
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

function loadLocalEnv() {
  const p = join(process.cwd(), ".env.local")
  if (!existsSync(p)) return
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadLocalEnv()

type EntryRow = {
  id: string | number
  title: string
  content: string
  category: string
  created_at: string
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizeTitle(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length
  const n = b.length
  const row = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) row[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = tmp
    }
  }
  return row[n]
}

function titleSimilarity(a: string, b: string): number {
  const x = normalizeTitle(a)
  const y = normalizeTitle(b)
  if (x === y) return 1
  const maxLen = Math.max(x.length, y.length, 1)
  return 1 - levenshtein(x, y) / maxLen
}

function wordSet(s: string): Set<string> {
  const words = s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
  return new Set(words)
}

function jaccardWords(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  const [sm, lg] = a.size <= b.size ? [a, b] : [b, a]
  for (const w of sm) if (lg.has(w)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

function normalizeContentKey(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

const WEAK_PATTERNS =
  /\b(test|tdd|lorem|ipsum|asdf|placeholder|deneme\s*123|xxx|foo|bar)\b|^\s*\.{3,}\s*$/i

function isWeakEntry(e: EntryRow): boolean {
  const t = e.title.trim()
  const c = e.content.trim()
  if (WEAK_PATTERNS.test(t) || WEAK_PATTERNS.test(c)) return true
  if (c.length < 100) return true
  if (t.length < 12 && c.length < 200) return true
  return false
}

async function fetchAllEntries(): Promise<EntryRow[]> {
  const pageSize = 1000
  const out: EntryRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("entries")
      .select("id, title, content, category, created_at")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    const batch = (data ?? []) as EntryRow[]
    out.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return out
}

function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }
}

async function run() {
  main()
  const rows = await fetchAllEntries()
  const lines: string[] = []

  const push = (s: string) => {
    lines.push(s)
    console.log(s)
  }

  const ISO = new Date().toISOString()
  push(`# Entries editorial report`)
  push(`Generated: ${ISO}`)
  push(`Total rows fetched: ${rows.length}`)
  push("")

  /* category counts */
  const byCat = new Map<string, number>()
  for (const r of rows) {
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1)
  }
  push("## Category counts")
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1])
  for (const [c, n] of cats) push(`- ${c}: ${n}`)
  push("")

  /* exact title (as stored) */
  const titleToIds = new Map<string, EntryRow[]>()
  for (const r of rows) {
    const list = titleToIds.get(r.title) ?? []
    list.push(r)
    titleToIds.set(r.title, list)
  }
  const exactTitleDups: { title: string; rows: EntryRow[] }[] = []
  for (const [title, list] of titleToIds) {
    if (list.length > 1) exactTitleDups.push({ title, rows: list })
  }
  exactTitleDups.sort((a, b) => b.rows.length - a.rows.length)

  push("## Exact duplicate titles (same title string)")
  if (exactTitleDups.length === 0) push("(none)")
  else {
    for (const g of exactTitleDups) {
      push(`- "${g.title.slice(0, 80)}${g.title.length > 80 ? "…" : ""}" → ${g.rows.length} rows`)
      for (const r of g.rows.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        push(`  - id=${r.id} created_at=${r.created_at}`)
      }
    }
  }
  push("")

  /* normalized title collision (different storage, same normalized) */
  const normToRows = new Map<string, EntryRow[]>()
  for (const r of rows) {
    const k = normalizeTitle(r.title)
    const list = normToRows.get(k) ?? []
    list.push(r)
    normToRows.set(k, list)
  }
  const normCollisions: { title: string; rows: EntryRow[] }[] = []
  for (const [nt, list] of normToRows) {
    const distinctTitles = new Set(list.map((x) => x.title))
    if (distinctTitles.size > 1) normCollisions.push({ title: nt, rows: list })
  }
  push("## Normalized-title collisions (different stored title, same normalized form)")
  if (normCollisions.length === 0) push("(none)")
  else {
    for (const g of normCollisions) {
      const head = g.title.length > 100 ? g.title.slice(0, 100) + "…" : g.title
      push(`- normalized: "${head}" (${g.rows.length} rows)`)
      for (const r of g.rows) {
        const th = r.title.length > 70 ? r.title.slice(0, 70) + "…" : r.title
        push(`  - id=${r.id} title="${th}"`)
      }
    }
  }
  push("")

  /* near-duplicate titles (not exact string, similarity in [0.88, 1)) */
  const TITLE_SIM_THRESHOLD = 0.88
  const seenNear = new Set<string>()
  const nearPairs: { a: EntryRow; b: EntryRow; sim: number }[] = []
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].title === rows[j].title) continue
      const sim = titleSimilarity(rows[i].title, rows[j].title)
      if (sim < TITLE_SIM_THRESHOLD || sim > 0.999) continue
      const key = [String(rows[i].id), String(rows[j].id)].sort().join(":")
      if (seenNear.has(key)) continue
      seenNear.add(key)
      nearPairs.push({ a: rows[i], b: rows[j], sim })
    }
  }
  nearPairs.sort((p, q) => q.sim - p.sim)
  push("## Near-duplicate titles (similarity >= 0.88, not identical string)")
  if (nearPairs.length === 0) push("(none)")
  else {
    for (const p of nearPairs.slice(0, 200)) {
      const ta = p.a.title.length > 60 ? p.a.title.slice(0, 60) + "…" : p.a.title
      const tb = p.b.title.length > 60 ? p.b.title.slice(0, 60) + "…" : p.b.title
      push(
        `- sim ${p.sim.toFixed(3)} | ${p.a.id} / ${p.b.id} [${p.a.category} / ${p.b.category}]`
      )
      push(`  A: ${ta}`)
      push(`  B: ${tb}`)
    }
    if (nearPairs.length > 200) {
      push(`(… ${nearPairs.length - 200} more pairs omitted)`)
    }
  }
  push("")

  /* exact content */
  const contentKeyToRows = new Map<string, EntryRow[]>()
  for (const r of rows) {
    const k = normalizeContentKey(r.content)
    const list = contentKeyToRows.get(k) ?? []
    list.push(r)
    contentKeyToRows.set(k, list)
  }
  const exactContentDups: EntryRow[][] = []
  for (const list of contentKeyToRows.values()) {
    if (list.length > 1) exactContentDups.push(list)
  }
  exactContentDups.sort((a, b) => b.length - a.length)
  push("## Exact duplicate content (whitespace-normalized body)")
  if (exactContentDups.length === 0) push("(none)")
  else {
    for (const list of exactContentDups) {
      push(`- ${list.length} rows share same content (${list[0].content.length} chars)`)
      for (const r of list) {
        const tt = r.title.length > 50 ? r.title.slice(0, 50) + "…" : r.title
        push(`  - id=${r.id} [${r.category}] "${tt}"`)
      }
    }
  }
  push("")

  /* high Jaccard content (same category, not exact content) */
  const JACC = 0.68
  const contentPairs: { a: EntryRow; b: EntryRow; j: number }[] = []
  const preWords = rows.map((r) => wordSet(r.content))
  for (let i = 0; i < rows.length; i++) {
    if (preWords[i].size < 25) continue
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].category !== rows[j].category) continue
      if (normalizeContentKey(rows[i].content) === normalizeContentKey(rows[j].content))
        continue
      if (preWords[j].size < 25) continue
      const jacc = jaccardWords(preWords[i], preWords[j])
      if (jacc < JACC) continue
      const lenRatio =
        Math.max(rows[i].content.length, rows[j].content.length) /
        Math.max(
          1,
          Math.min(rows[i].content.length, rows[j].content.length)
        )
      if (lenRatio > 1.6) continue
      contentPairs.push({ a: rows[i], b: rows[j], j: jacc })
    }
  }
  contentPairs.sort((p, q) => q.j - p.j)
  push("## High content overlap (Jaccard words >= 0.68, same category, not exact body)")
  if (contentPairs.length === 0) push("(none)")
  else {
    for (const p of contentPairs.slice(0, 120)) {
      push(
        `- j ${p.j.toFixed(3)} | ${p.a.id} / ${p.b.id} [${p.a.category}]`
      )
    }
    if (contentPairs.length > 120) {
      push(`(… ${contentPairs.length - 120} more pairs omitted)`)
    }
  }
  push("")

  /* weak */
  const weak = rows.filter(isWeakEntry)
  push("## Weak / test-like (heuristic: short body, or test keywords)")
  if (weak.length === 0) push("(none)")
  else {
    for (const r of weak) {
      const tt = r.title.length > 55 ? r.title.slice(0, 55) + "…" : r.title
      push(
        `- id=${r.id} [${r.category}] len=${r.content.length} | "${tt}"`
      )
    }
  }
  push("")

  /* recommendations */
  const keepIds = new Set<string>(rows.map((r) => String(r.id)))
  const exactDupGroupIds = new Set<string>()

  for (const g of exactTitleDups) {
    const sorted = [...g.rows].sort((a, b) =>
      a.created_at.localeCompare(b.created_at)
    )
    for (const r of sorted.slice(1)) {
      keepIds.delete(String(r.id))
      exactDupGroupIds.add(String(r.id))
    }
  }

  push("## Summary: classification")
  push(
    `- Certain duplicate (same title string): ${exactTitleDups.length} title groups, ~${exactDupGroupIds.size} redundant row(s) if keeping oldest per title`
  )
  push(
    `- Strong but similar titles: ${nearPairs.length} title pairs (review; optional merge)`
  )
  push(
    `- High content overlap pairs: ${contentPairs.length} (review; same-idea risk)`
  )
  push(`- Heuristic weak rows: ${weak.length}`)
  push(
    `- Suggested as keep (heuristic, after removing redundant exact-title dupes): ${keepIds.size} rows`
  )
  push("")

  push("## recommended removals (editorial, NOT applied)")
  push("Exact-title duplicates: keep earliest `created_at` per title; consider removing later ids:")
  if (exactTitleDups.length === 0) push("(none)")
  else {
    for (const g of exactTitleDups) {
      const sorted = [...g.rows].sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
      )
      const keep = sorted[0]!
      const drop = sorted.slice(1)
      push(
        `- keep id=${keep.id} | remove: ${drop.map((d) => d.id).join(", ")}`
      )
    }
  }
  push("")
  push("Near-duplicate / overlap pairs: review manually; no auto ID list (see sections above).")
  push("")

  const outPath = join(process.cwd(), "scripts", "ENTRIES_EDITORIAL_REPORT.md")
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8")
  push(`(Also written to ${outPath})`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
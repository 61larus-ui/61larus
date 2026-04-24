/**
 * Read-only audit of public.entries: duplicates and cleanup hints.
 * Does not call seed-entries; does not delete or update data.
 */
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

type Row = {
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

function normTitle(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function firstWords(s: string, n: number): string {
  return normTitle(s)
    .split(" ")
    .filter(Boolean)
    .slice(0, n)
    .join(" ")
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
  return row[n]!
}

function titleSim(a: string, b: string): number {
  const x = normTitle(a)
  const y = normTitle(b)
  if (x === y) return 1
  const maxLen = Math.max(x.length, y.length, 1)
  return 1 - levenshtein(x, y) / maxLen
}

const TESTISH =
  /\b(test|lorem|ipsum|asdf|placeholder|xxx|deneme\s*123|foo|bar)\b/i

function isShortOrTest(r: Row): boolean {
  if (TESTISH.test(r.title) || TESTISH.test(r.content)) return true
  if (r.content.trim().length < 100) return true
  if (r.title.trim().length < 10 && r.content.trim().length < 150) return true
  return false
}

async function fetchAll(): Promise<Row[]> {
  const pageSize = 1000
  const out: Row[] = []
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("entries")
      .select("id, title, content, category, created_at")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const batch = (data ?? []) as Row[]
    out.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return out
}

function idStr(x: Row): string {
  return String(x.id)
}

async function run() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }

  const rows = await fetchAll()

  const line = (s: string) => console.log(s)

  line("--- CATEGORY COUNTS ---")
  const byCat = new Map<string, number>()
  for (const r of rows) {
    byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1)
  }
  for (const [c, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    line(`${c}: ${n}`)
  }
  line("")

  line("--- EXACT DUPLICATES ---")
  const byTitle = new Map<string, Row[]>()
  for (const r of rows) {
    const t = r.title
    const list = byTitle.get(t) ?? []
    list.push(r)
    byTitle.set(t, list)
  }
  const exactGroups = [...byTitle.values()].filter((a) => a.length > 1)
  if (exactGroups.length === 0) line("(yok)")
  else {
    for (const g of exactGroups) {
      line(`title: ${g[0]!.title.slice(0, 100)}${g[0]!.title.length > 100 ? "…" : ""}`)
      line(`  adet: ${g.length}`)
      for (const r of g.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        line(`  - id=${idStr(r)}  created_at=${r.created_at}`)
      }
    }
  }
  line("")

  line("--- POSSIBLE DUPLICATES ---")
  const PREFIX_N = 6
  const byPrefix = new Map<string, Row[]>()
  for (const r of rows) {
    const k = firstWords(r.title, PREFIX_N)
    if (!k) continue
    const list = byPrefix.get(k) ?? []
    list.push(r)
    byPrefix.set(k, list)
  }

  const byNormFamily = new Map<string, Row[]>()
  for (const r of rows) {
    const k = normTitle(r.title)
    const list = byNormFamily.get(k) ?? []
    list.push(r)
    byNormFamily.set(k, list)
  }

  const possibleLines: string[] = []

  for (const [prefix, g] of byPrefix) {
    if (g.length < 2) continue
    const distinctTitles = new Set(g.map((x) => x.title))
    if (distinctTitles.size < 2) continue
    possibleLines.push(
      `Aynı ilk ${PREFIX_N} kelime (normalize): "${prefix.slice(0, 90)}${prefix.length > 90 ? "…" : ""}"`
    )
    for (const r of g) {
      const short = r.title.length > 85 ? r.title.slice(0, 85) + "…" : r.title
      possibleLines.push(`  - id=${idStr(r)}  [${r.category}]  ${short}`)
    }
    possibleLines.push("")
  }

  const SIM = 0.9
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i]!.title === rows[j]!.title) continue
      const s = titleSim(rows[i]!.title, rows[j]!.title)
      if (s < SIM || s > 0.999) continue
      const key = [idStr(rows[i]!), idStr(rows[j]!)].sort().join(":")
      if (seen.has(key)) continue
      seen.add(key)
      possibleLines.push(
        `Benzer başlık (Levenshtein-oranı ~${(s * 100).toFixed(1)}%):`
      )
      possibleLines.push(
        `  A id=${idStr(rows[i]!)}  ${rows[i]!.title.slice(0, 80)}${rows[i]!.title.length > 80 ? "…" : ""}`
      )
      possibleLines.push(
        `  B id=${idStr(rows[j]!)}  ${rows[j]!.title.slice(0, 80)}${rows[j]!.title.length > 80 ? "…" : ""}`
      )
      possibleLines.push("")
    }
  }

  if (possibleLines.length === 0) line("(yok – ön ek veya eşik dışı benzerlik)")
  else for (const s of possibleLines) line(s)
  line("")

  line("--- POSSIBLE CLEANUP ---")
  const cleanup: string[] = []

  for (const g of exactGroups) {
    const sorted = [...g].sort((a, b) => a.created_at.localeCompare(b.created_at))
    const keep = sorted[0]!
    for (const r of sorted.slice(1)) {
      cleanup.push(
        `Birebir aynı başlık tekrarı: en eski id=${idStr(keep)} tutulursa, aday id=${idStr(r)} (silinmeye aday, elle doğrulayın)`
      )
    }
  }

  for (const r of rows) {
    if (isShortOrTest(r)) {
      cleanup.push(
        `Kısa / test benzeri: id=${idStr(r)}  len(content)=${r.content.length}  title="${r.title.slice(0, 60)}${r.title.length > 60 ? "…" : ""}"`
      )
    }
  }

  for (const [k, g] of byNormFamily) {
    if (g.length < 2) continue
    if (g.every((x) => x.title === g[0]!.title)) continue
    cleanup.push(
      `Normalize başlık çakışması (farklı yazım): ${g.length} kayıt  key="${k.slice(0, 80)}${k.length > 80 ? "…" : ""}"  ids=${g.map((x) => idStr(x)).join(", ")}`
    )
  }

  if (cleanup.length === 0) line("(yok / veya sadece yukarıdaki ayrıntılara bakın)")
  else for (const c of cleanup) line(c)

  line("")
  line(`(toplam satır: ${rows.length}, salt okunur denetim)`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})

# Entries editorial report
Generated: 2026-04-23T14:50:51.537Z
Total rows fetched: 101

## Category counts
- Gündem: 12
- Şehir hafızası: 11
- Mahalleler: 11
- Coğrafya: 11
- Tarih: 11
- Şahsiyetler: 11
- Yurttaşlık Bilgisi: 10
- Spor: 10
- yerel-lezzetler: 8
- Gündelik hayat: 6

## Exact duplicate titles (same title string)
- "Trabzon'da çayın sadece içecek olmaktan çıkmasının nedeni ne?" → 3 rows
  - id=020799ad-0a69-48df-831d-4317c095e505 created_at=2026-04-23T13:27:50.383+00:00
  - id=c2042769-1c58-4706-aa90-a7ddc38743cc created_at=2026-04-23T13:27:58.246+00:00
  - id=c11d30c8-ab6c-4b01-b0a3-5e4543f119d7 created_at=2026-04-23T13:28:09.597+00:00
- "Trabzon'da sabahların kendine has bir ritmi olmasının sebebi ne?" → 3 rows
  - id=038773c1-febd-42fa-9438-25d36a8796b0 created_at=2026-04-23T13:27:50.383+00:00
  - id=4a42d776-c5af-45c1-a6c6-916991676a01 created_at=2026-04-23T13:27:58.246+00:00
  - id=27bedbca-84be-410b-be75-4010770580be created_at=2026-04-23T13:28:09.597+00:00
- "Trabzon'da herkesin birbirini tanıyor gibi hissettirmesinin bir sebebi var mı?" → 3 rows
  - id=ffade7d6-0533-488b-855a-0e42affdef1b created_at=2026-04-23T13:27:50.381+00:00
  - id=84b7bf1d-037c-435e-b183-8b0507a9d9a0 created_at=2026-04-23T13:27:58.245+00:00
  - id=12bcb6a9-8336-4e80-ae66-298e41ea937a created_at=2026-04-23T13:28:09.596+00:00
- "Trabzon'da yağmur neden planları bozmaz?" → 3 rows
  - id=99b277ef-cd83-4017-a7bd-5afa5353e2a3 created_at=2026-04-23T13:27:50.383+00:00
  - id=3d3c07b4-fcd4-4063-a014-7cba692df210 created_at=2026-04-23T13:27:58.246+00:00
  - id=e76ff1c8-1963-439b-9103-ad6ed2534b81 created_at=2026-04-23T13:28:09.597+00:00

## Normalized-title collisions (different stored title, same normalized form)
(none)

## Near-duplicate titles (similarity >= 0.88, not identical string)
(none)

## Exact duplicate content (whitespace-normalized body)
- 3 rows share same content (317 chars)
  - id=020799ad-0a69-48df-831d-4317c095e505 [Şehir hafızası] "Trabzon'da çayın sadece içecek olmaktan çıkmasının…"
  - id=c11d30c8-ab6c-4b01-b0a3-5e4543f119d7 [Şehir hafızası] "Trabzon'da çayın sadece içecek olmaktan çıkmasının…"
  - id=c2042769-1c58-4706-aa90-a7ddc38743cc [Şehir hafızası] "Trabzon'da çayın sadece içecek olmaktan çıkmasının…"
- 3 rows share same content (293 chars)
  - id=038773c1-febd-42fa-9438-25d36a8796b0 [Gündelik hayat] "Trabzon'da sabahların kendine has bir ritmi olması…"
  - id=27bedbca-84be-410b-be75-4010770580be [Gündelik hayat] "Trabzon'da sabahların kendine has bir ritmi olması…"
  - id=4a42d776-c5af-45c1-a6c6-916991676a01 [Gündelik hayat] "Trabzon'da sabahların kendine has bir ritmi olması…"
- 3 rows share same content (430 chars)
  - id=12bcb6a9-8336-4e80-ae66-298e41ea937a [Şehir hafızası] "Trabzon'da herkesin birbirini tanıyor gibi hissett…"
  - id=84b7bf1d-037c-435e-b183-8b0507a9d9a0 [Şehir hafızası] "Trabzon'da herkesin birbirini tanıyor gibi hissett…"
  - id=ffade7d6-0533-488b-855a-0e42affdef1b [Şehir hafızası] "Trabzon'da herkesin birbirini tanıyor gibi hissett…"
- 3 rows share same content (268 chars)
  - id=3d3c07b4-fcd4-4063-a014-7cba692df210 [Gündelik hayat] "Trabzon'da yağmur neden planları bozmaz?"
  - id=99b277ef-cd83-4017-a7bd-5afa5353e2a3 [Gündelik hayat] "Trabzon'da yağmur neden planları bozmaz?"
  - id=e76ff1c8-1963-439b-9103-ad6ed2534b81 [Gündelik hayat] "Trabzon'da yağmur neden planları bozmaz?"

## High content overlap (Jaccard words >= 0.68, same category, not exact body)
(none)

## Weak / test-like (heuristic: short body, or test keywords)
(none)

## Summary: classification
- Certain duplicate (same title string): 4 title groups, ~8 redundant row(s) if keeping oldest per title
- Strong but similar titles: 0 title pairs (review; optional merge)
- High content overlap pairs: 0 (review; same-idea risk)
- Heuristic weak rows: 0
- Suggested as keep (heuristic, after removing redundant exact-title dupes): 93 rows

## recommended removals (editorial, NOT applied)
Exact-title duplicates: keep earliest `created_at` per title; consider removing later ids:
- keep id=020799ad-0a69-48df-831d-4317c095e505 | remove: c2042769-1c58-4706-aa90-a7ddc38743cc, c11d30c8-ab6c-4b01-b0a3-5e4543f119d7
- keep id=038773c1-febd-42fa-9438-25d36a8796b0 | remove: 4a42d776-c5af-45c1-a6c6-916991676a01, 27bedbca-84be-410b-be75-4010770580be
- keep id=ffade7d6-0533-488b-855a-0e42affdef1b | remove: 84b7bf1d-037c-435e-b183-8b0507a9d9a0, 12bcb6a9-8336-4e80-ae66-298e41ea937a
- keep id=99b277ef-cd83-4017-a7bd-5afa5353e2a3 | remove: 3d3c07b4-fcd4-4063-a014-7cba692df210, e76ff1c8-1963-439b-9103-ad6ed2534b81

Near-duplicate / overlap pairs: review manually; no auto ID list (see sections above).


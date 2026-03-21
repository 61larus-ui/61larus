import FeedEntryCard from './feed-entry-card'

type EntryRow = {
  id: string
  content: string
  created_at: string
  author_id: string
  like_count: number
}

type Props = {
  entries: EntryRow[]
  usernameMap: Map<string, string>
  likedEntryIds: Set<string>
}

export default function FeedEntryList({
  entries,
  usernameMap,
  likedEntryIds,
}: Props) {
  if (entries.length === 0) {
    return (
      <section
        style={{
          border: '1px dashed #d1d5db',
          borderRadius: 16,
          padding: 24,
          backgroundColor: '#fff',
        }}
      >
        <p style={{ margin: 0, color: '#6b7280' }}>Henüz entry yok.</p>
      </section>
    )
  }

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      {entries.map((entry) => {
        const username = usernameMap.get(entry.author_id)
        const initialLiked = likedEntryIds.has(entry.id)

        return (
          <FeedEntryCard
            key={entry.id}
            entry={entry}
            username={username}
            initialLiked={initialLiked}
          />
        )
      })}
    </section>
  )
}
import Link from 'next/link'

type Entry = {
  id: string
  content: string
  created_at: string
  like_count: number
}

type ProfileEntryListProps = {
  entries: Entry[] | null
}

export function ProfileEntryList({ entries }: ProfileEntryListProps) {
  return (
    <div style={{ marginTop: 24 }}>
      <h2>Entryler</h2>

      {entries?.length === 0 ? (
        <p>Henüz entry yok.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {entries?.map((entry) => (
            <div
              key={entry.id}
              style={{
                border: '1px solid #ddd',
                padding: 16,
                borderRadius: 8,
              }}
            >
              <Link
                href={`/entry/${entry.id}`}
                style={{
                  display: 'block',
                  marginBottom: 8,
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                {entry.content}
              </Link>

              <small>{new Date(entry.created_at).toLocaleString('tr-TR')}</small>

              <div style={{ marginTop: 4 }}>
                <small>{entry.like_count} kişi kafa salladı</small>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
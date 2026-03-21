import Link from 'next/link'

type Entry = {
  id: string
  content: string
  created_at: string
  like_count: number
}

type Props = {
  entry: Entry
}

export default function DashboardEntryCard({ entry }: Props) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#fff',
      }}
    >
      <Link
        href={`/entry/${entry.id}`}
        style={{
          display: 'block',
          marginBottom: 8,
          color: 'inherit',
          textDecoration: 'none',
          fontSize: 16,
          lineHeight: 1.6,
          fontWeight: 500,
        }}
      >
        {entry.content}
      </Link>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <small style={{ color: '#6b7280' }}>
          {new Date(entry.created_at).toLocaleString('tr-TR')}
        </small>

        <small style={{ color: '#6b7280' }}>
          Beğeni: {entry.like_count}
        </small>
      </div>
    </div>
  )
}
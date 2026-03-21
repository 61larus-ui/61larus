import Link from 'next/link'
import FeedLikeButton from './feed-like-button'

type Props = {
  entry: {
    id: string
    content: string
    created_at: string
    author_id: string
    like_count: number
  }
  username?: string
  initialLiked: boolean
}

export default function FeedEntryCard({
  entry,
  username,
  initialLiked,
}: Props) {
  return (
    <article
      style={{
        border: '1px solid #e5e7eb',
        padding: 18,
        borderRadius: 14,
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <Link
          href={`/entry/${entry.id}`}
          style={{
            display: 'block',
            color: '#111827',
            textDecoration: 'none',
            fontSize: 17,
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          {entry.content}
        </Link>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {username ? (
            <Link
              href={`/u/${username}`}
              style={{
                textDecoration: 'none',
                color: '#0f766e',
                fontWeight: 600,
              }}
            >
              /u/{username}
            </Link>
          ) : (
            <span style={{ color: '#6b7280' }}>Bilinmeyen kullanıcı</span>
          )}
        </div>

        <small style={{ color: '#6b7280' }}>
          {new Date(entry.created_at).toLocaleString('tr-TR')}
        </small>
      </div>

      <div
        style={{
          paddingTop: 12,
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <FeedLikeButton
          entryId={entry.id}
          initialLikeCount={entry.like_count}
          initialLiked={initialLiked}
        />
      </div>
    </article>
  )
}
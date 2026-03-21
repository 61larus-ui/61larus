import Link from 'next/link'
import EntryLikeButton from './entry-like-button'

type Props = {
  entry: {
    id: string
    content: string
    created_at: string
    like_count: number
  }
  username: string | null
  initialLiked: boolean
}

export default function EntryDetailContent({
  entry,
  username,
  initialLiked,
}: Props) {
  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 16px' }}>
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Link href="/">Ana sayfa</Link>
        <Link href="/dashboard">Dashboard</Link>
        {username ? <Link href={`/u/${username}`}>/u/{username}</Link> : null}
      </div>

      <h1>Entry</h1>

      <div
        style={{
          border: '1px solid #ddd',
          padding: 16,
          borderRadius: 8,
          marginTop: 20,
        }}
      >
        <p style={{ marginBottom: 10 }}>{entry.content}</p>

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {username ? (
            <Link href={`/u/${username}`}>/u/{username}</Link>
          ) : (
            <span>Bilinmeyen kullanıcı</span>
          )}

          <small>{new Date(entry.created_at).toLocaleString('tr-TR')}</small>
        </div>

        <EntryLikeButton
          entryId={entry.id}
          initialLikeCount={entry.like_count}
          initialLiked={initialLiked}
        />
      </div>
    </div>
  )
}
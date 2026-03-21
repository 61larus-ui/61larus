import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

type Entry = {
  id: string
  content: string
  created_at: string
  like_count: number
}

export default async function UserProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const supabase = await createServerSupabaseClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, username, bio')
    .eq('username', params.username)
    .single()

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Kullanıcı bulunamadı</h1>
        <Link href="/">Ana sayfaya dön</Link>
      </div>
    )
  }

  const { data: entries } = await supabase
    .from('entries')
    .select('id, content, created_at, like_count')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/">Ana sayfa</Link>
      </div>

      <h1>/u/{user.username}</h1>

      {user.bio ? <p>{user.bio}</p> : null}

      <div style={{ marginTop: 24 }}>
        <h2>Entryler</h2>

        {entries?.length === 0 ? (
          <p>Henüz entry yok.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {entries?.map((entry: Entry) => (
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

                <small>
                  {new Date(entry.created_at).toLocaleString('tr-TR')}
                </small>

                <div style={{ marginTop: 4 }}>
                  <small>{entry.like_count} kişi kafa salladı</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
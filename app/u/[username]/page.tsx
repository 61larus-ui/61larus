import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProfileHeader } from './components/profile-header'
import { ProfileEntryList } from './components/profile-entry-list'

type Entry = {
  id: string
  content: string
  created_at: string
  like_count: number
}

type UserRow = {
  id: string
  username: string
  email: string | null
  bio: string | null
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createServerSupabaseClient()

  const { data: users } = await supabase
    .from('users')
    .select('id, username, email, bio')
    .order('username', { ascending: true })

  const user = users?.find(
    (item: UserRow) => item.username?.toLowerCase() === username.toLowerCase()
  )

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

      <ProfileHeader username={user.username} bio={user.bio} />
      <ProfileEntryList entries={entries as Entry[] | null} />
    </div>
  )
}
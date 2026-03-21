import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div style={{ padding: 20 }}>
        <h1>Giriş yapman gerekiyor</h1>
        <Link href="/login">Giriş yap</Link>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from('users')
    .select('username, bio')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ padding: 20 }}>
      <h1>Profil</h1>

      <p>Kullanıcı adı: {profile?.username}</p>
      <p>Biyografi: {profile?.bio || 'Yok'}</p>

      <Link href="/">Ana sayfa</Link>
    </div>
  )
}
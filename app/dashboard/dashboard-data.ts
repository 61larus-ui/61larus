import { createBrowserSupabaseClient } from '@/lib/supabase/client'

const supabase = createBrowserSupabaseClient()

export type DashboardProfile = {
  username: string
}

export type DashboardEntry = {
  id: string
  content: string
  created_at: string
  like_count: number
}

export async function getDashboardData() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      username: '',
      entries: [] as DashboardEntry[],
    }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single<DashboardProfile>()

  const { data: userEntries } = await supabase
    .from('entries')
    .select('id, content, created_at, like_count')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  return {
    user,
    username: profile?.username || '',
    entries: userEntries || [],
  }
}
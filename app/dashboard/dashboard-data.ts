import { createBrowserSupabaseClient } from '@/lib/supabase/client'

const supabase = createBrowserSupabaseClient()

export type DashboardProfile = {
  id: string
  username: string | null
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

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, username')
    .eq('id', user.id)
    .maybeSingle<DashboardProfile>()

  if (profileError) {
    console.error('Dashboard profile error:', profileError)
  }

  const { data: userEntries, error: entriesError } = await supabase
    .from('entries')
    .select('id, content, created_at, like_count')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (entriesError) {
    console.error('Dashboard entries error:', entriesError)
  }

  return {
    user,
    username: profile?.username || '',
    entries: userEntries || [],
  }
}
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function getEntryDetailData(entryId: string) {
  const supabase = await createServerSupabaseClient()

  const { data: entry } = await supabase
    .from('entries')
    .select('*')
    .eq('id', entryId)
    .single()

  if (!entry) {
    return {
      entry: null,
      username: '',
      initialLiked: false,
    }
  }

  const { data: userData } = await supabase
    .from('users')
    .select('username')
    .eq('id', entry.author_id)
    .single()

  const username = userData?.username || ''

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let initialLiked = false

  if (user) {
    const { data: like } = await supabase
      .from('entry_likes')
      .select('id')
      .eq('entry_id', entry.id)
      .eq('user_id', user.id)
      .maybeSingle()

    initialLiked = !!like
  }

  return {
    entry,
    username,
    initialLiked,
  }
}
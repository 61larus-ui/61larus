import { createServerSupabaseClient } from '@/lib/supabase/server'

type EntryRow = {
  id: string
  content: string
  created_at: string
  author_id: string
  like_count: number
}

type UserRow = {
  id: string
  username: string
}

type LikeRow = {
  entry_id: string
}

const FEED_LIMIT = 30

export async function getHomeFeedData() {
  const supabase = await createServerSupabaseClient()

  const { data: entries, error } = await supabase
    .from('entries')
    .select('id, content, created_at, author_id, like_count')
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT)

  if (error) {
    return {
      error: true,
      entries: [] as EntryRow[],
      usernameMap: new Map<string, string>(),
      likedEntryIds: new Set<string>(),
    }
  }

  const safeEntries: EntryRow[] = entries || []
  const authorIds = [...new Set(safeEntries.map((entry) => entry.author_id))]

  let users: UserRow[] = []

  if (authorIds.length > 0) {
    const { data: userRows } = await supabase
      .from('users')
      .select('id, username')
      .in('id', authorIds)

    users = userRows || []
  }

  const usernameMap = new Map(users.map((user) => [user.id, user.username]))

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let likedEntryIds = new Set<string>()

  if (user && safeEntries.length > 0) {
    const entryIds = safeEntries.map((entry) => entry.id)

    const { data: likes } = await supabase
      .from('entry_likes')
      .select('entry_id')
      .eq('user_id', user.id)
      .in('entry_id', entryIds)

    likedEntryIds = new Set(
      ((likes as LikeRow[] | null) || []).map((like) => like.entry_id)
    )
  }

  return {
    error: false,
    entries: safeEntries,
    usernameMap,
    likedEntryIds,
  }
}
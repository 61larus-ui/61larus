'use client'

import { useState } from 'react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

const supabase = createBrowserSupabaseClient()

type Props = {
  entryId: string
  initialLikeCount: number
  initialLiked: boolean
}

export default function FeedLikeButton({
  entryId,
  initialLikeCount,
  initialLiked,
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [loading, setLoading] = useState(false)

  const handleToggleLike = async () => {
    if (loading) return

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert('kafa sallamak için giriş yapman lazım')
      setLoading(false)
      return
    }

    if (liked) {
      setLiked(false)
      setLikeCount((prev) => Math.max(0, prev - 1))

      const { error } = await supabase
        .from('entry_likes')
        .delete()
        .eq('entry_id', entryId)
        .eq('user_id', user.id)

      if (error) {
        setLiked(true)
        setLikeCount((prev) => prev + 1)
        console.error(error)
        alert('kafayı geri çekerken bir şeyler oldu')
      }

      setLoading(false)
      return
    }

    setLiked(true)
    setLikeCount((prev) => prev + 1)

    const { error } = await supabase.from('entry_likes').insert({
      entry_id: entryId,
      user_id: user.id,
    })

    if (error) {
      const { data: existingLike } = await supabase
        .from('entry_likes')
        .select('entry_id')
        .eq('entry_id', entryId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingLike) {
        setLiked(true)
      } else {
        setLiked(false)
        setLikeCount((prev) => Math.max(0, prev - 1))
        console.error(error)
        alert('kafa sallarken bir şeyler ters gitti')
      }
    }

    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={handleToggleLike} disabled={loading}>
        {loading ? '...' : liked ? 'lafın dibine vurmuş ✔' : 'yerinde laf'}
      </button>

      <small>{likeCount} kişi kafa salladı</small>
    </div>
  )
}
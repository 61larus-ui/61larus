'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import DashboardEntryCard from './dashboard-entry-card'
import DashboardHeader from './dashboard-header'
import DashboardEntryComposer from './dashboard-entry-composer'
import { getDashboardData, type DashboardEntry } from './dashboard-data'

const supabase = createBrowserSupabaseClient()

export default function DashboardPage() {
  const router = useRouter()

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [entries, setEntries] = useState<DashboardEntry[]>([])

  const loadDashboardData = async () => {
    const data = await getDashboardData()

    if (!data.user) {
      router.push('/login')
      return
    }

    setUsername(data.username)
    setEntries(data.entries)
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  const handleSubmit = async () => {
    if (!content.trim()) return

    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      alert('Giriş yapman lazım')
      setLoading(false)
      return
    }

    const { error } = await supabase.from('entries').insert({
      content,
      author_id: user.id,
    })

    if (error) {
      console.error(error)
      alert('Hata oluştu')
    } else {
      setContent('')
      alert('Entry paylaşıldı 🚀')
      await loadDashboardData()
    }

    setLoading(false)
  }

  const handleLogout = async () => {
    if (logoutLoading) return

    setLogoutLoading(true)

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error(error)
      alert('Çıkış yapılırken bir şeyler oldu')
      setLogoutLoading(false)
      return
    }

    router.push('/login')
    router.refresh()
  }

  return (
    <main style={{ maxWidth: 760, margin: '40px auto', padding: '0 16px 48px' }}>
      <DashboardHeader
        username={username}
        logoutLoading={logoutLoading}
        onLogout={handleLogout}
      />

      <DashboardEntryComposer
        content={content}
        loading={loading}
        onChange={setContent}
        onSubmit={handleSubmit}
      />

      <section>
        <h2>Benim entrylerim</h2>

        {entries.length === 0 ? (
          <p>Henüz entry yok.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {entries.map((entry) => (
              <DashboardEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
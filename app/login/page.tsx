'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

const supabase = createBrowserSupabaseClient()

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()

    if (!cleanEmail || !cleanPassword) {
      alert('Email ve şifre girmen lazım')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    })

    if (error) {
      console.error(error)
      alert('Giriş başarısız')
      setLoading(false)
      return
    }

    // 🔥 kritik fix
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/">Ana sayfa</Link>
      </div>

      <h1>Giriş yap</h1>

      <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 12 }}
        />

        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 12 }}
        />

        <button onClick={handleLogin} disabled={loading}>
          {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </button>
      </div>

      <p style={{ marginTop: 16 }}>
        Hesabın yok mu? <Link href="/register">Kayıt ol</Link>
      </p>
    </div>
  )
}
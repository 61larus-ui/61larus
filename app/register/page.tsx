'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

const supabase = createBrowserSupabaseClient()

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !username.trim()) {
      alert('Tüm alanları doldurman lazım')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error || !data.user) {
      console.error(error)
      alert('Kayıt başarısız')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id,
      username,
    })

    if (insertError) {
      console.error(insertError)
      alert('Kullanıcı oluşturulurken hata')
      setLoading(false)
      return
    }

    alert('Kayıt başarılı 🚀')

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ maxWidth: 500, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/">Ana sayfa</Link>
      </div>

      <h1>Kayıt ol</h1>

      <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
        <input
          placeholder="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: 12 }}
        />

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

        <button onClick={handleRegister} disabled={loading}>
          {loading ? 'Kayıt yapılıyor...' : 'Kayıt ol'}
        </button>
      </div>

      <p style={{ marginTop: 16 }}>
        Zaten hesabın var mı? <Link href="/login">Giriş yap</Link>
      </p>
    </div>
  )
}
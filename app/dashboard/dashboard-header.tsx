import Link from 'next/link'

type Props = {
  username: string
  logoutLoading: boolean
  onLogout: () => void
}

export default function DashboardHeader({
  username,
  logoutLoading,
  onLogout,
}: Props) {
  return (
    <section
      style={{
        marginBottom: 24,
        padding: 20,
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        backgroundColor: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <Link href="/">Ana sayfa</Link>
        {username ? <Link href={`/u/${username}`}>Profilime git</Link> : null}

        <button onClick={onLogout} disabled={logoutLoading}>
          {logoutLoading ? 'Çıkış yapılıyor...' : 'Çıkış yap'}
        </button>
      </div>

      <h1 style={{ marginTop: 0 }}>Dashboard</h1>

      {username ? (
        <p style={{ marginBottom: 20 }}>
          Public profilin: <Link href={`/u/${username}`}>/u/{username}</Link>
        </p>
      ) : null}
    </section>
  )
}
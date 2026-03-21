import Link from 'next/link'

export default function HomeHeader() {
  return (
    <section
      style={{
        marginBottom: 24,
        padding: 20,
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: '#111827',
            fontWeight: 600,
          }}
        >
          Ana sayfa
        </Link>

        <Link
          href="/dashboard"
          style={{
            textDecoration: 'none',
            color: '#0f766e',
            fontWeight: 600,
          }}
        >
          Dashboard
        </Link>
      </div>

      <h1
        style={{
          margin: '0 0 8px',
          fontSize: 32,
          lineHeight: 1.1,
        }}
      >
        61larus
      </h1>

      <p
        style={{
          margin: 0,
          color: '#4b5563',
          fontSize: 16,
          lineHeight: 1.6,
        }}
      >
        Trabzon’un lafı, gündemi, hafızası. Son entryler burada akıyor.
      </p>
    </section>
  )
}
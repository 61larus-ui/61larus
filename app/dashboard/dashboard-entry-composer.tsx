type Props = {
  content: string
  loading: boolean
  onChange: (value: string) => void
  onSubmit: () => void
}

export default function DashboardEntryComposer({
  content,
  loading,
  onChange,
  onSubmit,
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
      <textarea
        placeholder="Bir şey yaz..."
        value={content}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: 120,
          padding: 12,
          marginBottom: 10,
          borderRadius: 12,
          border: '1px solid #d1d5db',
        }}
      />

      <button onClick={onSubmit} disabled={loading}>
        {loading ? 'Gönderiliyor...' : 'Paylaş'}
      </button>
    </section>
  )
}
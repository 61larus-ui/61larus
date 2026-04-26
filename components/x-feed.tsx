export default function XFeed() {
  return (
    <div style={{ marginTop: "24px" }}>
      <p style={{ fontSize: "14px", opacity: 0.6 }}>
        61Larus X paylaşımları
      </p>

      <a
        href="https://x.com/6Larus/status/2048436993718157792"
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block",
          marginTop: "12px",
          padding: "14px 0",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          textDecoration: "none",
          color: "inherit"
        }}
      >
        <div style={{ fontSize: "13px", opacity: 0.55, marginBottom: "8px" }}>
          @6Larus · X’te
        </div>

        <div style={{ fontSize: "17px", lineHeight: "1.35" }}>
          Trabzon’da en güzel manzara nerede?
        </div>

        <div style={{ fontSize: "13px", opacity: 0.55, marginTop: "10px" }}>
          Paylaşımı X’te gör →
        </div>
      </a>

      <a
        href="https://x.com/6Larus"
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-block",
          marginTop: "14px",
          fontSize: "14px",
          textDecoration: "underline"
        }}
      >
        X’te takip et →
      </a>
    </div>
  );
}

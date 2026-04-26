export default function EntrySlugLoading() {
  return (
    <div className="entry-detail-page">
      <div className="entry-detail-page-inner">
        <div
          className="entry-detail-skeleton"
          style={{ minHeight: "9rem" }}
          aria-hidden
        >
          <p className="entry-detail-loading m-0">Yazı açılıyor…</p>
        </div>
      </div>
    </div>
  );
}

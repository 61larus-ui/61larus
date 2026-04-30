/** Entry route beklerken boş ekran yerine kısa iskelet. */
export default function EntrySlugLoading() {
  return (
    <div className="entry-detail-page">
      <div className="entry-detail-page-inner">
        <div className="animate-pulse">
          <div className="mb-6 flex min-h-[1.5rem] items-center md:mb-7">
            <div className="h-3 w-24 rounded-sm bg-[color:var(--divide)]" />
          </div>
          <div
            className="rounded-md border border-[color:var(--divide-muted)] bg-[color:var(--surface-panel)] px-4 py-5 md:px-5 md:py-6"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <div className="h-7 max-w-[min(100%,28rem)] rounded-sm bg-[color:var(--divide)] md:h-8" />
            <div className="mt-4 flex gap-2">
              <div className="h-3 w-24 rounded-sm bg-[color:var(--divide-muted)]" />
              <div className="h-3 w-16 rounded-sm bg-[color:var(--divide-muted)]" />
            </div>
            <div className="mt-6 space-y-2.5">
              <div className="h-3 w-full rounded-sm bg-[color:var(--divide-muted)]" />
              <div className="h-3 w-full rounded-sm bg-[color:var(--divide-muted)]" />
              <div className="h-3 w-[92%] rounded-sm bg-[color:var(--divide-muted)]" />
              <div className="h-3 w-[78%] rounded-sm bg-[color:var(--divide-muted)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

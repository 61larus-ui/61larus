/** Katkılarım segment yüklenirken kısa iskelet — RSC tamamlanınca kaybolur. */
export default function KatkilarimLoading() {
  return (
    <div className="my-comments-page my-comments-page-inner">
      <div className="home-page-container mx-auto w-full animate-pulse py-8 md:py-10">
        <div className="h-4 w-28 rounded-sm bg-[color:var(--divide)]" />
        <div className="mt-3 h-3 max-w-md rounded-sm bg-[color:var(--divide-muted)]" />
        <ul className="mt-10 flex list-none flex-col gap-4 p-0 m-0 md:mt-10">
          {[0, 1, 2].map((i) => (
            <li key={i} className="m-0 p-0">
              <div className="h-24 rounded-md border border-[color:var(--divide-muted)] bg-[color:var(--bg-secondary)]" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

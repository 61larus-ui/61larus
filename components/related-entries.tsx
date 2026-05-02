import Link from "next/link";

type RelatedEntry = {
  id: string;
  title: string;
  slug: string | null;
};

export function RelatedEntries({ items }: { items: RelatedEntry[] }) {
  if (!items.length) return null;

  return (
    <section className="entry-related-block" aria-labelledby="related-entries-title">
      <div id="related-entries-title" className="entry-related-kicker">
        BU BAŞLIK SESSİZ KALMIŞ — SEN NE DİYORSUN?
      </div>

      <div className="entry-related-list">
        {items.map((item) => {
          const href = item.slug ? `/${item.slug}` : "#";

          return (
            <Link key={item.id} href={href} className="entry-related-link">
              {item.title}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

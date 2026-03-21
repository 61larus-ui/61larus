import FeedEntryList from './feed-entry-list'
import HomeHeader from './home-header'
import { getHomeFeedData } from './home-feed-data'

export default async function HomePage() {
  const { error, entries, usernameMap, likedEntryIds } =
    await getHomeFeedData()

  if (error) {
    return (
      <div style={{ maxWidth: 760, margin: '40px auto', padding: '0 16px' }}>
        <h1>61larus</h1>
        <p>Feed yüklenirken hata oluştu.</p>
      </div>
    )
  }

  return (
    <main
      style={{
        maxWidth: 760,
        margin: '40px auto',
        padding: '0 16px 48px',
      }}
    >
      <HomeHeader />

      <FeedEntryList
        entries={entries}
        usernameMap={usernameMap}
        likedEntryIds={likedEntryIds}
      />
    </main>
  )
}
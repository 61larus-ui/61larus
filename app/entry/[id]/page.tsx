import EntryDetailContent from './entry-detail-content'
import { getEntryDetailData } from './entry-detail-data'

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function EntryPage({ params }: Props) {
  const { id } = await params
  const { entry, username, initialLiked } = await getEntryDetailData(id)

  if (!entry) {
    return <div>Entry bulunamadı</div>
  }

  return (
    <EntryDetailContent
      entry={entry}
      username={username}
      initialLiked={initialLiked}
    />
  )
}
type ProfileHeaderProps = {
  username: string
  bio: string | null
}

export function ProfileHeader({ username, bio }: ProfileHeaderProps) {
  return (
    <>
      <h1>/u/{username}</h1>
      {bio ? <p>{bio}</p> : null}
    </>
  )
}
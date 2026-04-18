import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // MUST be service role key
)

async function run() {
  const { data, error } = await supabase.storage.createBucket('avatars', {
    public: true
  })

  if (error && !error.message.includes('already exists')) {
    console.error('ERROR:', error)
  } else {
    console.log('Bucket ready: avatars')
  }
}

run()

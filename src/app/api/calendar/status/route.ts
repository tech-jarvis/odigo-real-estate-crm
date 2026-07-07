import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('oauth_tokens')
    .select('provider')
    .eq('user_id', user.id)

  const connected = new Set((data ?? []).map((r) => r.provider))
  return NextResponse.json({
    google: connected.has('google'),
    outlook: connected.has('outlook'),
  })
}

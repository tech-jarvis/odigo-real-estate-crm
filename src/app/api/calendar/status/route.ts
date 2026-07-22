import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('oauth_tokens')
    .select('provider, account_email')
    .eq('user_id', user.id)

  const byProvider = new Map((data ?? []).map((r) => [r.provider, r.account_email]))
  return NextResponse.json({
    google: byProvider.has('google'),
    googleEmail: byProvider.get('google') ?? null,
    outlook: byProvider.has('outlook'),
    outlookEmail: byProvider.get('outlook') ?? null,
  })
}

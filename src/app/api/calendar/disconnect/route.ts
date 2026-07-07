import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { provider } = await request.json() as { provider?: string }
  if (provider !== 'google' && provider !== 'outlook') {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const { error } = await supabase
    .from('oauth_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', provider)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

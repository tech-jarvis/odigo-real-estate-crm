import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('calendar_connect_tokens')
    .insert({ token, user_id: user.id, expires_at: expiresAt })

  if (error) return NextResponse.json({ error: 'Failed to create token' }, { status: 500 })

  const mcpBase = process.env.NEXT_PUBLIC_MCP_URL ?? 'https://odigo-mcp.vercel.app'
  return NextResponse.json({ token, mcpBase })
}

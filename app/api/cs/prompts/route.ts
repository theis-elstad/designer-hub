export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET — list all prompts (active only by default, or all versions for a slug)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const allVersions = searchParams.get('allVersions') === 'true'

  let query = (supabase as any).from('cs_prompts').select('*')

  if (slug) {
    query = query.eq('slug', slug)
    if (!allVersions) query = query.eq('is_active', true)
    query = query.order('version', { ascending: false })
  } else {
    // Return only active prompts
    query = query.eq('is_active', true).order('slug')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prompts: data })
}

// POST — create a new version of a prompt
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { slug, system_prompt, user_prompt_template } = body as {
    slug: string
    system_prompt: string
    user_prompt_template?: string
  }

  if (!slug || !system_prompt) {
    return NextResponse.json({ error: 'slug and system_prompt are required' }, { status: 400 })
  }

  // Get current max version
  const { data: existing } = await (supabase as any)
    .from('cs_prompts')
    .select('version, title, description')
    .eq('slug', slug)
    .order('version', { ascending: false })
    .limit(1)

  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: 'Prompt slug not found' }, { status: 404 })
  }

  const newVersion = existing[0].version + 1

  // Deactivate all old versions
  await (supabase as any)
    .from('cs_prompts')
    .update({ is_active: false })
    .eq('slug', slug)

  // Insert new active version
  const { data: created, error } = await (supabase as any)
    .from('cs_prompts')
    .insert({
      slug,
      version: newVersion,
      is_active: true,
      title: existing[0].title,
      description: existing[0].description,
      system_prompt,
      user_prompt_template: user_prompt_template ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prompt: created })
}

// PATCH — revert to a specific version (make it active)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { slug, version } = body as { slug: string; version: number }

  if (!slug || !version) {
    return NextResponse.json({ error: 'slug and version are required' }, { status: 400 })
  }

  // Deactivate all versions
  await (supabase as any)
    .from('cs_prompts')
    .update({ is_active: false })
    .eq('slug', slug)

  // Activate target version
  const { error } = await (supabase as any)
    .from('cs_prompts')
    .update({ is_active: true })
    .eq('slug', slug)
    .eq('version', version)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

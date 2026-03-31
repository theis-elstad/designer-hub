export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')

    if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })

    const { data, error } = await (supabase as any)
      .from('cs_avatars')
      .select('*')
      .eq('brand_id', brandId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ avatars: data ?? [] })
  } catch (err) {
    console.error('Avatars GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch avatars' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { brand_id, name, research, products_used = [] } = body as {
      brand_id: string
      name: string
      research: Record<string, unknown>
      products_used?: string[]
    }

    if (!brand_id || !name || !research) {
      return NextResponse.json({ error: 'brand_id, name, and research are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const { data, error } = await (supabase as any)
      .from('cs_avatars')
      .insert({ id, brand_id, user_id: user.id, name, research, products_used })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ avatar: data })
  } catch (err) {
    console.error('Avatars POST error:', err)
    return NextResponse.json({ error: 'Failed to create avatar' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { id, ...updates } = body as { id: string; [key: string]: unknown }

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { data, error } = await (supabase as any)
      .from('cs_avatars')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ avatar: data })
  } catch (err) {
    console.error('Avatars PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 })
  }
}

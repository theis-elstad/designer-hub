export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    let query = (supabase as any)
      .from('cs_brands')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (q) {
      query = query.ilike('brand_name', `%${q}%`)
    }

    const { data, error } = await query.limit(20)
    if (error) throw error

    return NextResponse.json({ brands: data ?? [] })
  } catch (err) {
    console.error('Brands GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch brands' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { brand_name, domain, guidelines = [] } = body as {
      brand_name: string
      domain: string
      guidelines?: string[]
    }

    if (!brand_name || !domain) {
      return NextResponse.json({ error: 'brand_name and domain are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const { data, error } = await (supabase as any)
      .from('cs_brands')
      .insert({ id, user_id: user.id, brand_name, domain, guidelines })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ brand: data })
  } catch (err) {
    console.error('Brands POST error:', err)
    return NextResponse.json({ error: 'Failed to create brand' }, { status: 500 })
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
      .from('cs_brands')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ brand: data })
  } catch (err) {
    console.error('Brands PATCH error:', err)
    return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
  }
}

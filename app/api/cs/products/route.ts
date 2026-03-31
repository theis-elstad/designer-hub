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
    const q = searchParams.get('q')?.trim()

    if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 })

    let query = (supabase as any)
      .from('cs_products')
      .select('*')
      .eq('brand_id', brandId)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (q) {
      query = query.ilike('name', `%${q}%`)
    }

    const { data, error } = await query.limit(20)
    if (error) throw error

    return NextResponse.json({ products: data ?? [] })
  } catch (err) {
    console.error('Products GET error:', err)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { brand_id, name, url, type = 'product' } = body as {
      brand_id: string
      name: string
      url: string
      type?: 'product' | 'collection'
    }

    if (!brand_id || !name || !url) {
      return NextResponse.json({ error: 'brand_id, name, and url are required' }, { status: 400 })
    }

    const id = crypto.randomUUID()
    const { data, error } = await (supabase as any)
      .from('cs_products')
      .insert({ id, brand_id, user_id: user.id, name, url, type })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ product: data })
  } catch (err) {
    console.error('Products POST error:', err)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}

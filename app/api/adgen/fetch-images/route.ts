export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ProductImage {
  src: string
  width: number
  height: number
  alt: string | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { url } = await request.json()

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  try {
    const parsed = new URL(url)

    // Try Shopify .json endpoint if URL contains /products/
    if (parsed.pathname.includes('/products/')) {
      const jsonUrl = `${parsed.origin}${parsed.pathname}.json`

      const response = await fetch(jsonUrl, {
        headers: { Accept: 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        const product = data.product

        if (product) {
          const images: ProductImage[] = (product.images || [])
            .filter((img: any) => img.width > 500)
            .map((img: any) => ({
              src: img.src,
              width: img.width,
              height: img.height,
              alt: img.alt || null,
            }))

          return NextResponse.json({
            title: product.title,
            images,
          })
        }
      }
    }

    // Non-Shopify URL or failed to fetch — return empty images
    return NextResponse.json({
      title: null,
      images: [],
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch product images' },
      { status: 500 }
    )
  }
}

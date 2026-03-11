export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAISummary } from '@/lib/ai'

interface ShopifyProduct {
  title: string
  body_html: string
  vendor: string
  product_type: string
  tags: string[]
  variants: Array<{ title: string; price: string }>
  images: Array<{ src: string }>
}

function extractShopifyHandle(url: string): { domain: string; handle: string } | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const match = u.pathname.match(/\/products\/([^/?#]+)/)
    if (!match) return null
    return { domain: u.origin, handle: match[1] }
  } catch {
    return null
  }
}

async function fetchShopifyProduct(domain: string, handle: string): Promise<ShopifyProduct | null> {
  try {
    const res = await fetch(`${domain}/products/${handle}.json`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json() as { product: ShopifyProduct }
    return data.product ?? null
  } catch {
    return null
  }
}

async function scrapeProductPage(url: string): Promise<string> {
  try {
    const res = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdGen/2.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 6000)
  } catch {
    return ''
  }
}

const PRODUCT_RESEARCH_SYSTEM = `You are a product marketing expert. Analyze the product and return a JSON object with this exact structure:
{
  "productName": "string",
  "productType": "string",
  "price": "string",
  "targetCustomer": "string",
  "keyBenefits": ["string"],
  "painPointsSolved": ["string"],
  "uniqueSellingPoints": ["string"],
  "useCases": ["string"],
  "competitiveContext": "string",
  "emotionalTriggers": ["string"]
}
Be specific and actionable. Focus on what makes this product compelling to its target audience.`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { productUrl } = body as { productUrl: string }

    if (!productUrl) {
      return NextResponse.json({ error: 'productUrl is required' }, { status: 400 })
    }

    let productContext = ''

    // Try Shopify JSON API first
    const shopifyInfo = extractShopifyHandle(productUrl)
    if (shopifyInfo) {
      const shopifyProduct = await fetchShopifyProduct(shopifyInfo.domain, shopifyInfo.handle)
      if (shopifyProduct) {
        const variantSummary = shopifyProduct.variants
          .slice(0, 5)
          .map((v) => `${v.title}: $${v.price}`)
          .join(', ')
        const description = shopifyProduct.body_html
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 2000)

        productContext = `Product Name: ${shopifyProduct.title}
Type: ${shopifyProduct.product_type}
Vendor: ${shopifyProduct.vendor}
Tags: ${Array.isArray(shopifyProduct.tags) ? shopifyProduct.tags.join(', ') : (shopifyProduct.tags || '')}
Variants & Pricing: ${variantSummary}
Description: ${description}`
      }
    }

    // Fallback: scrape the page
    if (!productContext) {
      const scraped = await scrapeProductPage(productUrl)
      productContext = scraped || `Product URL: ${productUrl} (content unavailable)`
    }

    const userPrompt = `Analyze this product:\nURL: ${productUrl}\n\n${productContext}`

    const raw = await generateAISummary(PRODUCT_RESEARCH_SYSTEM, userPrompt)

    let research: Record<string, unknown>
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      research = JSON.parse(match?.[0] ?? raw)
    } catch {
      return NextResponse.json({ error: 'Failed to parse product research' }, { status: 500 })
    }

    return NextResponse.json({ research })
  } catch (err) {
    console.error('Product research error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Product research failed' },
      { status: 500 }
    )
  }
}

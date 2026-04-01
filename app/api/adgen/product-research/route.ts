export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAISummary } from '@/lib/ai'
import { getSystemPrompt } from '@/lib/prompts'

interface ShopifyProduct {
  title: string
  body_html: string
  vendor: string
  product_type: string
  tags: string[]
  variants: Array<{ title: string; price: string }>
  images: Array<{ src: string }>
}

interface ShopifyCollection {
  title: string
  body_html: string
}

type UrlKind = 'product' | 'collection' | 'brand'

function classifyUrl(url: string): { kind: UrlKind; domain: string; handle: string | null } {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    const productMatch = u.pathname.match(/\/products\/([^/?#]+)/)
    if (productMatch) return { kind: 'product', domain: u.origin, handle: productMatch[1] }
    const collectionMatch = u.pathname.match(/\/collections\/([^/?#]+)/)
    if (collectionMatch) return { kind: 'collection', domain: u.origin, handle: collectionMatch[1] }
    return { kind: 'brand', domain: u.origin, handle: null }
  } catch {
    return { kind: 'brand', domain: url, handle: null }
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

async function fetchShopifyCollection(
  domain: string,
  handle: string
): Promise<{ collection: ShopifyCollection | null; products: ShopifyProduct[] }> {
  try {
    // Fetch collection metadata
    let collection: ShopifyCollection | null = null
    try {
      const colRes = await fetch(`${domain}/collections/${handle}.json`, {
        signal: AbortSignal.timeout(6000),
      })
      if (colRes.ok) {
        const colData = await colRes.json()
        collection = colData.collection ?? null
      }
    } catch {
      // Collection metadata is optional
    }

    // Fetch products in collection
    const prodRes = await fetch(`${domain}/collections/${handle}/products.json?limit=20`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!prodRes.ok) return { collection, products: [] }
    const prodData = await prodRes.json()
    return { collection, products: prodData.products ?? [] }
  } catch {
    return { collection: null, products: [] }
  }
}

async function scrapePage(url: string): Promise<string> {
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

const COLLECTION_RESEARCH_SYSTEM = `You are a product marketing expert. Analyze this product collection and return a JSON object with this exact structure:
{
  "productName": "string (collection name)",
  "productType": "string (collection category)",
  "price": "string (price range across products)",
  "targetCustomer": "string",
  "keyBenefits": ["string"],
  "painPointsSolved": ["string"],
  "uniqueSellingPoints": ["string"],
  "useCases": ["string"],
  "competitiveContext": "string",
  "emotionalTriggers": ["string"]
}
Treat the collection as a cohesive product line. Focus on the shared appeal and positioning across the products.`

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

    const { kind, domain, handle } = classifyUrl(productUrl)
    let context = ''
    let systemPrompt = await getSystemPrompt('product-research', PRODUCT_RESEARCH_SYSTEM)

    if (kind === 'product' && handle) {
      // ── Single product ──
      const shopifyProduct = await fetchShopifyProduct(domain, handle)
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

        context = `Product Name: ${shopifyProduct.title}
Type: ${shopifyProduct.product_type}
Vendor: ${shopifyProduct.vendor}
Tags: ${Array.isArray(shopifyProduct.tags) ? shopifyProduct.tags.join(', ') : (shopifyProduct.tags || '')}
Variants & Pricing: ${variantSummary}
Description: ${description}`
      }
    } else if (kind === 'collection' && handle) {
      // ── Collection ──
      systemPrompt = await getSystemPrompt('collection-research', COLLECTION_RESEARCH_SYSTEM)
      const { collection, products } = await fetchShopifyCollection(domain, handle)

      const parts: string[] = []
      if (collection) {
        parts.push(`Collection: ${collection.title}`)
        if (collection.body_html) {
          const desc = collection.body_html
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 1000)
          parts.push(`Description: ${desc}`)
        }
      }
      parts.push(`${products.length} products in collection`)

      // Summarize products
      for (const p of products.slice(0, 10)) {
        const price = p.variants?.[0]?.price ? `$${p.variants[0].price}` : 'N/A'
        parts.push(`- ${p.title} (${p.product_type || 'N/A'}, ${price})`)
      }

      context = parts.join('\n')
    }

    // Fallback: scrape the page for any URL type
    if (!context) {
      const scraped = await scrapePage(productUrl)
      context = scraped || `URL: ${productUrl} (content unavailable)`
    }

    const label = kind === 'collection' ? 'collection' : 'product'
    const userPrompt = `Analyze this ${label}:\nURL: ${productUrl}\n\n${context}`

    const raw = await generateAISummary(systemPrompt, userPrompt)

    let research: Record<string, unknown>
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      research = JSON.parse(match?.[0] ?? raw)
    } catch {
      return NextResponse.json({ error: `Failed to parse ${label} research` }, { status: 500 })
    }

    return NextResponse.json({ research, urlType: kind })
  } catch (err) {
    console.error('Product/collection research error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Research failed' },
      { status: 500 }
    )
  }
}

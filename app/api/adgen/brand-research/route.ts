export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAISummary } from '@/lib/ai'
import { getSystemPrompt } from '@/lib/prompts'

function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return url.toLowerCase().replace(/^www\./, '')
  }
}

async function scrapeWebsite(url: string): Promise<string> {
  const target = url.startsWith('http') ? url : `https://${url}`
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdGen/2.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    // Strip tags, collapse whitespace, limit length
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000)
  } catch {
    return ''
  }
}

const BRAND_RESEARCH_SYSTEM = `You are a brand strategist and marketing expert. Analyze the brand and return a JSON object with this exact structure:
{
  "brandName": "string",
  "industry": "string",
  "targetAudience": "string",
  "valueProposition": "string",
  "brandVoice": "string",
  "keyMessages": ["string"],
  "competitiveAdvantages": ["string"],
  "productCategories": ["string"],
  "pricePoint": "budget | mid-range | premium | luxury",
  "brandPersonality": ["string"]
}
Be specific and actionable. Base your analysis on the website content provided, or on your knowledge of the brand if content is unavailable.`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { brandUrl } = body as { brandUrl: string }

    if (!brandUrl) {
      return NextResponse.json({ error: 'brandUrl is required' }, { status: 400 })
    }

    const domain = extractDomain(brandUrl)

    // Check cache
    const { data: cached } = await (supabase as any)
      .from('adgen_brand_research')
      .select('research, brand_name')
      .eq('brand_url', domain)
      .single()

    if (cached) {
      return NextResponse.json({ research: cached.research, brandName: cached.brand_name, cached: true })
    }

    // Scrape website
    const pageContent = await scrapeWebsite(`https://${domain}`)

    const userPrompt = pageContent
      ? `Analyze this brand: ${domain}\n\nWebsite content:\n${pageContent}`
      : `Analyze this brand based on your knowledge: ${domain}`

    const systemPrompt = await getSystemPrompt('brand-research', BRAND_RESEARCH_SYSTEM)
    const raw = await generateAISummary(systemPrompt, userPrompt)

    let research: Record<string, unknown>
    try {
      // Extract JSON from response (may have surrounding text)
      const match = raw.match(/\{[\s\S]*\}/)
      research = JSON.parse(match?.[0] ?? raw)
    } catch {
      return NextResponse.json({ error: 'Failed to parse brand research' }, { status: 500 })
    }

    const brandName = (research.brandName as string) || domain

    // Save to cache
    await (supabase as any).from('adgen_brand_research').upsert({
      id: crypto.randomUUID(),
      brand_url: domain,
      brand_name: brandName,
      research,
    })

    return NextResponse.json({ research, brandName, cached: false })
  } catch (err) {
    console.error('Brand research error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Brand research failed' },
      { status: 500 }
    )
  }
}

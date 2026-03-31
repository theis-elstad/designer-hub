export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAISummary } from '@/lib/ai'

const SUGGESTIONS_SYSTEM = `You are a world-class marketing analyst and consumer psychologist.
Given a brand and optionally a product/collection, identify 3 distinct buyer archetypes that represent genuinely different customer segments.

Return ONLY a JSON array (no markdown, no code fences):
[
  {
    "name": "A humanized archetype name (e.g., 'Status-Seeking Sophia')",
    "archetype": "Brief archetype label (e.g., 'The Aspirational Professional')",
    "summary": "2-3 sentence description of who they are, what drives them, and why they'd buy this product. Be specific and vivid — real human behavior, not marketing speak."
  }
]

Make each archetype meaningfully different in age, motivation, and lifestyle. Ground them in authentic consumer behavior patterns.`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { brandResearch, productResearch } = body as {
      brandResearch: Record<string, unknown>
      productResearch?: Record<string, unknown>
    }

    if (!brandResearch) {
      return NextResponse.json({ error: 'brandResearch is required' }, { status: 400 })
    }

    let userPrompt = `Identify 3 buyer archetypes for:

BRAND: ${brandResearch.brandName || 'Unknown'}
Industry: ${brandResearch.industry || 'Unknown'}
Target Audience: ${brandResearch.targetAudience || 'Unknown'}
Price Point: ${brandResearch.pricePoint || 'Unknown'}
Value Proposition: ${brandResearch.valueProposition || 'Unknown'}`

    if (productResearch) {
      userPrompt += `

PRODUCT: ${productResearch.productName || 'Unknown'}
Type: ${productResearch.productType || 'Unknown'}
Target Customer: ${productResearch.targetCustomer || 'Unknown'}
Key Benefits: ${Array.isArray(productResearch.keyBenefits) ? (productResearch.keyBenefits as string[]).join(', ') : 'Unknown'}`
    }

    const raw = await generateAISummary(SUGGESTIONS_SYSTEM, userPrompt, 1024)

    let suggestions: unknown[]
    try {
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()
      const match = cleaned.match(/\[[\s\S]*\]/) || cleaned.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(match?.[0] ?? cleaned)
      suggestions = Array.isArray(parsed) ? parsed : (parsed.suggestions ?? parsed.avatars ?? [])
    } catch {
      console.error('Failed to parse avatar suggestions:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Failed to parse suggestions' }, { status: 500 })
    }

    return NextResponse.json({ suggestions })
  } catch (err) {
    console.error('Avatar suggestions error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Avatar suggestions failed' },
      { status: 500 }
    )
  }
}

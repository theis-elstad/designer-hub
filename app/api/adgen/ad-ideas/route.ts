export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAISummary } from '@/lib/ai'
import { getSystemPrompt } from '@/lib/prompts'

// Shuffle array in-place (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CORE_DESIRES = [
  'Status & Prestige',
  'Security & Safety',
  'Convenience & Ease',
  'Belonging & Connection',
  'Achievement & Mastery',
  'Beauty & Health',
  'Savings & Value',
  'Freedom & Independence',
  'Curiosity & Discovery',
  'Pleasure & Enjoyment',
  'Nostalgia & Familiarity',
  'Altruism & Purpose',
]

const HEURISTICS = [
  'Social Proof',
  'Specificity & Numbers',
  'Novelty & Surprise',
  'Authority & Expertise',
  'Scarcity & Urgency',
  'Before & After',
  'Problem → Agitate → Solve',
  'Comparison & Contrast',
  'Story & Narrative',
  'Humor & Wit',
]

const AD_IDEAS_SYSTEM = `You are a world-class advertising strategist. Generate compelling ad concepts that leverage psychological triggers and proven advertising heuristics.

Return ONLY a JSON object (no markdown, no code fences) with this structure:
{"ideas": [
  {
    "title": "Short concept name (3-5 words)",
    "coreDesire": "one of the core desires",
    "heuristic": "one of the heuristics",
    "headline": "Punchy ad headline (max 30 chars)",
    "messagingAngle": "1-2 sentences describing the core message and how it connects emotionally",
    "visualConcept": "1-2 sentences describing the ideal visual/creative direction",
    "adFormat": "feed_image | story | carousel | video_concept"
  }
]}

Make each concept genuinely different — vary the emotional angle, format, and audience segment.`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { brandResearch, productResearch, count = 6 } = body as {
      brandResearch: Record<string, unknown>
      productResearch: Record<string, unknown>
      count?: number
    }

    if (!brandResearch || !productResearch) {
      return NextResponse.json({ error: 'brandResearch and productResearch are required' }, { status: 400 })
    }

    // Shuffle desires and heuristics for variety across runs
    const desires = shuffle(CORE_DESIRES).slice(0, 8).join(', ')
    const heuristics = shuffle(HEURISTICS).slice(0, 6).join(', ')

    const userPrompt = `Generate ${count} ad concepts for this product.

CORE DESIRES to draw from (pick the most relevant): ${desires}
HEURISTICS to apply: ${heuristics}

BRAND CONTEXT:
${JSON.stringify(brandResearch, null, 2)}

PRODUCT CONTEXT:
${JSON.stringify(productResearch, null, 2)}`

    const adIdeasSystem = await getSystemPrompt('ad-ideas', AD_IDEAS_SYSTEM)
    const raw = await generateAISummary(adIdeasSystem, userPrompt)

    let ideas: unknown[]
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/) || cleaned.match(/\[[\s\S]*\]/)
      const parsed = JSON.parse(match?.[0] ?? cleaned)
      // Handle both array and {ideas: [...]} shapes
      ideas = Array.isArray(parsed) ? parsed : (parsed.ideas ?? parsed.concepts ?? [])
    } catch {
      console.error('Failed to parse ad ideas response:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Failed to parse ad ideas' }, { status: 500 })
    }

    return NextResponse.json({ ideas })
  } catch (err) {
    console.error('Ad ideas error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ad ideas generation failed' },
      { status: 500 }
    )
  }
}

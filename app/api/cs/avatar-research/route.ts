export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAISummary } from '@/lib/ai'
import { getSystemPrompt } from '@/lib/prompts'

const DEEP_RESEARCH_SYSTEM = `Today, you are a world-class marketing analyst and consumer psychologist.
Your mission: to uncover the deep emotional, psychological, and behavioral drivers that motivate our ideal customer to purchase this specific product or service.

You are not looking for surface-level answers — only the raw, unfiltered truths behind what they feel, fear, and desire.
These insights will never be shared with the customer; they are solely for crafting more empathetic, relevant, and persuasive marketing.

You understand that people buy emotionally and justify logically, so your goal is to expose their true emotional motivators — the private thoughts, insecurities, and desires that fuel their decisions.

Your Task:
Using the context provided, produce a complete deep-dive buyer profile following this structure:

1. Demographic Overview
1.1 Name / Archetype (use the provided archetype name)
1.2 Age range, gender, lifestyle summary
1.3 Brief description of who they are and what they care about most.

2. Core Problem
2.1 Define the central, painful problem they face — the one this product is built to solve.
2.2 Include why it's so urgent and emotionally charged.

3. Emotional Landscape
3.1 Top 5 most powerful emotions they feel around this problem.
3.2 Top 5 biggest fears (the kind that keep them awake at night).
3.3 For each fear, describe how it affects their relationships.
3.4 List 5 hurtful things people in their lives might say.

4. Past Attempts & Frustrations
4.1 What they've already tried to solve this problem (5 examples).
4.2 Why those solutions failed (include short soundbites in their own voice).
4.3 What they don't want to do again.

5. The Dream Scenario
5.1 If they could snap their fingers for a perfect fix, what would their life look like?
5.2 Describe 5 vivid, specific outcomes showing emotional and practical transformation.
5.3 Include how this affects their relationships, identity, and confidence.

6. Market Psychology
6.1 What success in this market is believed to depend on.
6.2 What they subconsciously gain from keeping their problem.
6.3 Who or what they blame for their situation.
6.4 Top 5 objections or limiting beliefs that stop them from solving it.

7. Final Avatar Summary
7.1 Write a comprehensive summary — emotional drivers, desires, fears, frustrations, and motivations.
7.2 Use a raw, conversational tone — as if writing their inner monologue.
7.3 Include short, realistic quotes they might think or say privately.

Guidelines:
- Write in their language, not in "marketing speak."
- Be vivid, descriptive, and emotionally real.
- It's OK to explore "dark" or superficial motivations — this is for understanding, not judgment.

Return ONLY a JSON object (no markdown, no code fences) with this structure:
{
  "name": "The archetype name",
  "demographics": "Age, gender, lifestyle summary",
  "coreProblem": "The central problem and why it's emotionally charged",
  "emotions": ["Top 5 emotions"],
  "fears": ["Top 5 fears with relationship impact"],
  "hurtfulQuotes": ["5 things people say that hurt them"],
  "pastAttempts": ["What they tried and why it failed"],
  "avoidances": ["What they refuse to do again"],
  "dreamOutcomes": ["5 vivid transformation outcomes"],
  "marketBeliefs": "What they think success depends on",
  "hiddenGains": "What they gain from keeping the problem",
  "blame": "Who/what they blame",
  "objections": ["Top 5 objections or limiting beliefs"],
  "innerMonologue": "Raw, conversational persona summary with private quotes",
  "psychographics": "Values, lifestyle, interests, personality traits",
  "painPoints": ["Specific pain points this product solves"],
  "desires": ["Core desires and aspirations"],
  "buyingTriggers": ["What would make them buy right now"],
  "mediaHabits": "Where they spend time online, platforms, browsing patterns",
  "brandRelationship": "How they discover and relate to this brand"
}`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { brandResearch, productResearch, suggestion } = body as {
      brandResearch: Record<string, unknown>
      productResearch?: Record<string, unknown>
      suggestion: { name: string; archetype: string; summary: string }
    }

    if (!brandResearch || !suggestion) {
      return NextResponse.json({ error: 'brandResearch and suggestion are required' }, { status: 400 })
    }

    const userPrompt = `Produce a deep-dive buyer profile for this archetype:

ARCHETYPE: ${suggestion.name}
Type: ${suggestion.archetype}
Initial Description: ${suggestion.summary}

BRAND CONTEXT:
Client Name: ${brandResearch.brandName || 'Unknown'}
Industry: ${brandResearch.industry || 'Unknown'}
Primary Audience: ${brandResearch.targetAudience || 'Unknown'}
Core Offer: ${brandResearch.valueProposition || 'Unknown'}
Price Point: ${brandResearch.pricePoint || 'Unknown'}
Brand Voice: ${brandResearch.brandVoice || 'Unknown'}
Key Messages: ${Array.isArray(brandResearch.keyMessages) ? (brandResearch.keyMessages as string[]).join(', ') : 'Unknown'}${productResearch ? `

PRODUCT CONTEXT:
Product: ${productResearch.productName || 'Unknown'}
Type: ${productResearch.productType || 'Unknown'}
Target Customer: ${productResearch.targetCustomer || 'Unknown'}
Key Benefits: ${Array.isArray(productResearch.keyBenefits) ? (productResearch.keyBenefits as string[]).join(', ') : 'Unknown'}
Pain Points Solved: ${Array.isArray(productResearch.painPointsSolved) ? (productResearch.painPointsSolved as string[]).join(', ') : 'Unknown'}
Emotional Triggers: ${Array.isArray(productResearch.emotionalTriggers) ? (productResearch.emotionalTriggers as string[]).join(', ') : 'Unknown'}` : ''}`

    const deepResearchSystem = await getSystemPrompt('avatar-deep-research', DEEP_RESEARCH_SYSTEM)
    const raw = await generateAISummary(deepResearchSystem, userPrompt, 8192)

    let research: Record<string, unknown>
    try {
      const cleaned = raw.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim()
      const match = cleaned.match(/\{[\s\S]*\}/)
      research = JSON.parse(match?.[0] ?? cleaned)
    } catch {
      console.error('Failed to parse avatar deep research:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Failed to parse avatar research' }, { status: 500 })
    }

    return NextResponse.json({ research })
  } catch (err) {
    console.error('Avatar research error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Avatar research failed' },
      { status: 500 }
    )
  }
}

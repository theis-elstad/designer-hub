export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateAISummary } from '@/lib/ai'
import { getSystemPrompt } from '@/lib/prompts'
import { callGemini, imagePartFromBase64, textPart } from '@/lib/gemini'
import type { ImageLabel } from '@/lib/types/adgen'

interface ReferenceImage {
  url?: string
  base64?: string
  mimeType: string
  label: ImageLabel
}

async function fetchImageAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`)
  const buffer = await res.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function buildPromptWithImageDescriptions(
  basePrompt: string,
  images: ReferenceImage[]
): string {
  const productRefs = images.filter((i) => i.label === 'product-reference')
  const inspirations = images.filter((i) => i.label === 'inspiration')

  let context = ''
  if (productRefs.length > 0) {
    context += `

REFERENCE IMAGES: The first ${productRefs.length} image(s) show the actual product. Match the product's appearance, colors, and details closely.`
  }
  if (inspirations.length > 0) {
    context += `
INSPIRATION IMAGES: The ${productRefs.length > 0 ? 'remaining' : ''} image(s) are style/mood references. Draw from their aesthetic, composition, and feel.`
  }

  return basePrompt + context
}

const IMAGE_PROMPT_SYSTEM = `You are a creative director specializing in social media advertising.
Generate a detailed, vivid image generation prompt for an ad creative.

The prompt should describe:
1. The main subject and composition
2. Lighting and mood
3. Color palette that aligns with the brand
4. Style (photorealistic, lifestyle, product-focused, etc.)
5. Any text overlay suggestions

Keep the prompt under 200 words. Do NOT include any text that would appear in the image as overlay — focus purely on the visual.
Return only the image prompt text, no preamble.`

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { adIdea, brandResearch, productResearch, images, format } = body as {
      adIdea: Record<string, unknown>
      brandResearch: Record<string, unknown>
      productResearch: Record<string, unknown>
      images?: ReferenceImage[]
      format?: string
    }

    if (!adIdea || !brandResearch) {
      return NextResponse.json(
        { error: 'adIdea and brandResearch are required' },
        { status: 400 }
      )
    }

    const aspectRatio = format || '1:1'

    // Step 1: Generate image prompt via Claude
    let imagePromptRequest = `Create an image generation prompt for this ad creative:

AD CONCEPT:
Title: ${adIdea.title}
Messaging Angle: ${adIdea.messagingAngle}
Visual Concept: ${adIdea.visualConcept}
Format: ${aspectRatio} aspect ratio

BRAND:
Name: ${brandResearch.brandName}
Voice: ${brandResearch.brandVoice}
Personality: ${Array.isArray(brandResearch.brandPersonality) ? (brandResearch.brandPersonality as string[]).join(', ') : ''}`

    if (productResearch) {
      imagePromptRequest += `

PRODUCT:
Name: ${productResearch.productName}
Type: ${productResearch.productType}`
    }

    imagePromptRequest += `

HEADLINE: ${adIdea.headline ?? ''}`

    const imagePromptSystem = await getSystemPrompt('image-prompt', IMAGE_PROMPT_SYSTEM)
    const imagePrompt = await generateAISummary(imagePromptSystem, imagePromptRequest)

    // Step 2: Build Gemini parts — reference images first, then text prompt
    const geminiParts = []

    if (images && images.length > 0) {
      const sorted = [
        ...images.filter((i) => i.label === 'product-reference'),
        ...images.filter((i) => i.label === 'inspiration'),
      ]
      for (const img of sorted) {
        const b64 = img.base64 || (await fetchImageAsBase64(img.url!))
        geminiParts.push(imagePartFromBase64(b64, img.mimeType))
      }
      geminiParts.push(textPart(buildPromptWithImageDescriptions(imagePrompt, images)))
    } else {
      geminiParts.push(textPart(imagePrompt))
    }

    // Step 3: Generate image via Gemini
    const generatedImages = await callGemini(geminiParts, { aspectRatio })

    if (generatedImages.length === 0) {
      return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
    }

    return NextResponse.json({
      imageBase64: generatedImages[0].base64,
      mimeType: generatedImages[0].mimeType,
      imagePrompt,
      generatedBy: 'gemini-3-pro',
      adFormat: aspectRatio,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Ad creative error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Ad creative generation failed' },
      { status: 500 }
    )
  }
}

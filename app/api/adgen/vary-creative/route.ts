export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGemini, imagePartFromBase64, textPart } from '@/lib/gemini'
import { getSystemPrompt } from '@/lib/prompts'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageBase64, mimeType, format } = await request.json()

  if (!imageBase64) {
    return NextResponse.json(
      { error: 'Image is required' },
      { status: 400 }
    )
  }

  try {
    const variationPrompt = await getSystemPrompt(
      'variation',
      'Create a variation of this ad creative. Keep the same general concept, product, and style but vary the composition, lighting, angle, or mood to create a fresh take.'
    )
    const parts = [
      imagePartFromBase64(imageBase64, mimeType || 'image/jpeg'),
      textPart(variationPrompt),
    ]

    const images = await callGemini(parts, {
      aspectRatio: format || '1:1',
    })

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'Variation generation failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      imageBase64: images[0].base64,
      mimeType: images[0].mimeType,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Variation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const runtime = 'edge'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGemini, imagePartFromBase64, textPart } from '@/lib/gemini'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { imageBase64, mimeType, instruction } = await request.json()

  if (!imageBase64 || !instruction) {
    return NextResponse.json(
      { error: 'Image and instruction are required' },
      { status: 400 }
    )
  }

  try {
    const parts = [
      imagePartFromBase64(imageBase64, mimeType || 'image/jpeg'),
      textPart(`Edit this ad creative image according to the following instruction: ${instruction}`),
    ]

    const images = await callGemini(parts)

    if (images.length === 0) {
      return NextResponse.json({ error: 'Edit failed' }, { status: 500 })
    }

    return NextResponse.json({
      imageBase64: images[0].base64,
      mimeType: images[0].mimeType,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Edit failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

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

  const { imageBase64, mimeType, targetFormat } = await request.json()

  if (!imageBase64 || !targetFormat) {
    return NextResponse.json(
      { error: 'Image and target format are required' },
      { status: 400 }
    )
  }

  try {
    const parts = [
      imagePartFromBase64(imageBase64, mimeType || 'image/jpeg'),
      textPart(
        `Reformat this ad creative image to a ${targetFormat} aspect ratio. Maintain the same visual content, style, and quality. Adjust the composition to best fit the new format.`
      ),
    ]

    const images = await callGemini(parts, { aspectRatio: targetFormat })

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'Format change failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      imageBase64: images[0].base64,
      mimeType: images[0].mimeType,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Format change failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

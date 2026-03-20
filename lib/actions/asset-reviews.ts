'use server'

import { createClient } from '@/lib/supabase/server'

export async function getAssetReview(assetId: string): Promise<{ stars: number; comment: string | null } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('asset_reviews') as any)
    .select('stars, comment')
    .eq('asset_id', assetId)
    .eq('reviewer_id', user.id)
    .maybeSingle()

  return data || null
}

export async function submitAssetReview(
  assetId: string,
  stars: number,
  comment: string | null
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (stars < 1 || stars > 5) return { error: 'Stars must be between 1 and 5' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('asset_reviews') as any).upsert(
    {
      asset_id: assetId,
      reviewer_id: user.id,
      stars,
      comment: comment?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'asset_id,reviewer_id' }
  )

  if (error) return { error: error.message }
  return { success: true }
}

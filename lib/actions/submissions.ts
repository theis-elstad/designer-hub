'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isVideoFile, isWeekendDate } from '@/lib/utils'

// Helper to get server's current date (UTC)
function getServerDate(): string {
  return new Date().toISOString().split('T')[0]
}

// Helper to validate a date is within allowed range (up to 7 days ago)
function isDateInRange(dateStr: string): boolean {
  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  date.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= 7
}

export async function checkSubmission(targetDate?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { hasSubmitted: false, submissionId: null, currentDate: getServerDate() }

  // Use provided date or server's current date
  const date = targetDate || getServerDate()

  const { data } = await supabase
    .from('submissions')
    .select('id, comment, is_completed, assets(*)')
    .eq('user_id', user.id)
    .eq('submission_date', date)
    .single()

  type SubmissionWithAssets = {
    id: string
    comment: string | null
    is_completed: boolean
    assets: { id: string; submission_id: string; storage_path: string; file_name: string; file_size: number | null; asset_type?: 'image' | 'video'; duration?: number | null; created_at: string }[]
  }

  const typedData = data as SubmissionWithAssets | null

  // Ensure asset_type is present (infer from filename if not in DB yet)
  const assetsWithType = (typedData?.assets || []).map((asset) => ({
    ...asset,
    asset_type: asset.asset_type || (isVideoFile(asset.file_name) ? 'video' : 'image') as 'image' | 'video',
    duration: asset.duration ?? null,
  }))

  return {
    hasSubmitted: !!typedData,
    submissionId: typedData?.id || null,
    existingAssets: assetsWithType,
    existingComment: typedData?.comment || null,
    isCompleted: typedData?.is_completed || false,
    currentDate: date,
  }
}

// Keep old function name for backwards compatibility
export async function checkTodaySubmission() {
  return checkSubmission()
}

export async function createSubmission(assetFiles: { path: string; duration?: number }[], targetDate?: string, comment?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Use provided date or server's current date
  const date = targetDate || getServerDate()

  // Validate date is within allowed range
  if (targetDate && !isDateInRange(targetDate)) {
    return { error: 'Cannot submit for dates more than 7 days ago or in the future' }
  }

  // Block weekend submissions
  if (isWeekendDate(date)) {
    return { error: 'Submissions are only accepted on weekdays (Monday–Friday)' }
  }

  // Trim comment, treat empty string as null
  const trimmedComment = comment?.trim() || null

  // Check if already submitted for this date
  const { hasSubmitted, submissionId: existingId } = await checkSubmission(date)

  let submissionId = existingId

  if (!hasSubmitted) {
    // Create new submission with explicit date and optional comment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: submission, error: submitError } = await (supabase.from('submissions') as any)
      .insert({ user_id: user.id, submission_date: date, comment: trimmedComment })
      .select()
      .single()

    if (submitError) {
      return { error: submitError.message }
    }
    submissionId = submission.id
  } else if (submissionId && trimmedComment !== undefined) {
    // Update comment on existing submission
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('submissions') as any)
      .update({ comment: trimmedComment, updated_at: new Date().toISOString() })
      .eq('id', submissionId)
  }

  if (!submissionId) {
    return { error: 'Failed to create submission' }
  }

  // Create asset records
  const assets = assetFiles.map((file) => {
    const fileName = file.path.split('/').pop() || 'unknown'
    const isVideo = isVideoFile(fileName)
    return {
      submission_id: submissionId,
      storage_path: file.path,
      file_name: fileName,
      asset_type: isVideo ? 'video' : 'image',
      duration: isVideo && file.duration ? file.duration : null,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: assetsError } = await (supabase.from('assets') as any).insert(assets)

  if (assetsError) {
    return { error: assetsError.message }
  }

  // Mark submission as updated and reset is_completed when new assets are added to an existing submission
  if (hasSubmitted && submissionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('submissions') as any)
      .update({ updated_at: new Date().toISOString(), is_completed: false })
      .eq('id', submissionId)
  }

  revalidatePath('/submit')
  return { success: true, submissionId }
}

export async function updateComment(submissionId: string, comment: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const trimmedComment = comment.trim() || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('submissions') as any)
    .update({ comment: trimmedComment, updated_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/submit')
  return { success: true }
}

export async function deleteAsset(assetId: string, storagePath: string) {
  const supabase = await createClient()

  // Get the submission_id before deleting the asset
  const { data: asset } = await supabase
    .from('assets')
    .select('submission_id')
    .eq('id', assetId)
    .single() as { data: { submission_id: string } | null }

  // Delete from storage
  await supabase.storage.from('submissions').remove([storagePath])

  // Delete from database
  const { error } = await supabase.from('assets').delete().eq('id', assetId)

  if (error) {
    return { error: error.message }
  }

  // Mark submission as updated and reset is_completed
  if (asset?.submission_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('submissions') as any)
      .update({ updated_at: new Date().toISOString(), is_completed: false })
      .eq('id', asset.submission_id)
  }

  revalidatePath('/submit')
  return { success: true }
}

export async function markSubmissionComplete(submissionId: string, isCompleted: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('submissions') as any)
    .update({ is_completed: isCompleted, updated_at: new Date().toISOString() })
    .eq('id', submissionId)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/submit')
  revalidatePath('/judge', 'layout')
  return { success: true }
}

export async function saveTimeAllocation(date: string, allocation: '0-30' | '30-70' | '70-100') {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('time_allocations') as any).upsert(
    {
      user_id: user.id,
      allocation_date: date,
      allocation,
    },
    { onConflict: 'user_id,allocation_date' }
  )

  if (error) return { error: error.message }
  return { success: true }
}

export async function getTimeAllocation(date: string): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('time_allocations')
    .select('allocation')
    .eq('user_id', user.id)
    .eq('allocation_date', date)
    .single()

  return (data as { allocation: string } | null)?.allocation || null
}

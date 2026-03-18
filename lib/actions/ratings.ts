'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeWeightedProductivityCount } from '@/lib/utils'

function computeSuggestedProductivity(
  assetCount: number,
  medianAssetCount: number,
  allocation?: '0-30' | '30-70' | '70-100'
): number {
  const multiplier = allocation === '0-30' ? 0.3 : allocation === '30-70' ? 0.6 : 1.0
  const adjustedMedian = medianAssetCount * multiplier
  if (adjustedMedian === 0) return 3
  const ratio = assetCount / adjustedMedian
  if (ratio <= 0.6) return 1
  if (ratio <= 0.8) return 2
  if (ratio <= 1.0) return 3
  if (ratio <= 1.2) return 4
  return 5
}

export async function getDesignerGallery(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ id: string; signedUrl: string; fileName: string; assetType: string; duration: number | null; submissionDate: string }[]> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.rpc as any)('get_designer_assets', {
    p_user_id: userId,
    p_start_date: startDate,
    p_end_date: endDate,
  })

  if (!data || data.length === 0) return []

  type AssetRow = { asset_id: string; storage_path: string; file_name: string; asset_type: string; duration: number | null; submission_date: string }

  const results = await Promise.all(
    (data as AssetRow[]).map(async (asset) => {
      const { data: urlData } = await supabase.storage
        .from('submissions')
        .createSignedUrl(asset.storage_path, 3600)
      return {
        id: asset.asset_id,
        signedUrl: urlData?.signedUrl || '',
        fileName: asset.file_name,
        assetType: asset.asset_type,
        duration: asset.duration,
        submissionDate: asset.submission_date,
      }
    })
  )

  return results.filter((r) => r.signedUrl !== '')
}

export async function getSubmissionsForJudging(date?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  // Build query with profile join and asset_type
  // Only show submissions that designers have marked as completed
  let query = supabase
    .from('submissions')
    .select(
      `
      id,
      submission_date,
      user_id,
      comment,
      updated_at,
      profiles (
        full_name
      ),
      assets (
        id,
        storage_path,
        file_name,
        asset_type,
        duration
      ),
      ratings!left (
        id,
        rated_by,
        productivity,
        quality,
        comment,
        created_at
      )
    `
    )
    .eq('is_completed', true)
    .order('submission_date', { ascending: false })
    .limit(500)

  // Only filter by date if one is provided
  if (date) {
    query = query.eq('submission_date', date)
  }

  const { data: submissions } = await query

  // Define types for the query result
  type SubmissionForJudging = {
    id: string
    submission_date: string
    user_id: string
    comment: string | null
    updated_at: string | null
    profiles: { full_name: string | null }
    assets: { id: string; storage_path: string; file_name: string; asset_type: 'image' | 'video'; duration: number | null }[]
    ratings: { id: string; rated_by: string; productivity: number; quality: number; comment: string | null; created_at: string }[]
  }

  const typedSubmissions = (submissions || []) as SubmissionForJudging[]

  // Determine status: needs_review, rated, or edited
  // A submission is "rated" once ANY admin has rated it (not just the current user)
  return typedSubmissions.map((sub) => {
    const myRating = sub.ratings?.find((r) => r.rated_by === user.id)
    const hasAnyRating = sub.ratings && sub.ratings.length > 0

    let status: 'needs_review' | 'rated' | 'edited' = 'needs_review'
    if (hasAnyRating) {
      const latestRating = sub.ratings.reduce((latest, r) =>
        new Date(r.created_at) > new Date(latest.created_at) ? r : latest
      )
      if (sub.updated_at && new Date(sub.updated_at) > new Date(latestRating.created_at)) {
        status = 'edited'
      } else {
        status = 'rated'
      }
    }

    return {
      id: sub.id,
      submission_date: sub.submission_date,
      user_id: sub.user_id,
      comment: sub.comment,
      submitterName: sub.profiles?.full_name || 'Unknown',
      imageCount: sub.assets?.filter((a) => a.asset_type === 'image').length || 0,
      videoCount: sub.assets?.filter((a) => a.asset_type === 'video').length || 0,
      assets: sub.assets || [],
      status,
      myRating: myRating || null,
    }
  })
}

export async function getSubmissionForJudgingById(submissionId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('submissions')
    .select(
      `
      id,
      submission_date,
      user_id,
      comment,
      updated_at,
      profiles (
        full_name
      ),
      assets (
        id,
        storage_path,
        file_name,
        asset_type,
        duration
      ),
      ratings!left (
        id,
        rated_by,
        productivity,
        quality,
        comment,
        created_at,
        profiles (
          full_name
        )
      )
    `
    )
    .eq('id', submissionId)
    .single()

  if (!data) return null

  type SubmissionResult = {
    id: string
    submission_date: string
    user_id: string
    comment: string | null
    updated_at: string | null
    profiles: { full_name: string | null }
    assets: { id: string; storage_path: string; file_name: string; asset_type: 'image' | 'video'; duration: number | null }[]
    ratings: { id: string; rated_by: string; productivity: number; quality: number; comment: string | null; created_at: string; profiles: { full_name: string | null } }[]
  }

  const sub = data as SubmissionResult
  const myRating = sub.ratings?.find((r) => r.rated_by === user.id)
  const hasAnyRating = sub.ratings && sub.ratings.length > 0

  let status: 'needs_review' | 'rated' | 'edited' = 'needs_review'
  if (hasAnyRating) {
    const latestRating = sub.ratings.reduce((latest, r) =>
      new Date(r.created_at) > new Date(latest.created_at) ? r : latest
    )
    if (sub.updated_at && new Date(sub.updated_at) > new Date(latestRating.created_at)) {
      status = 'edited'
    } else {
      status = 'rated'
    }
  }

  // Calculate suggested productivity based on weighted median for the day
  const { data: daySubmissions } = await supabase
    .from('submissions')
    .select('id, assets(id, asset_type, duration)')
    .eq('submission_date', sub.submission_date)

  type DaySubmission = { id: string; assets: { id: string; asset_type: 'image' | 'video'; duration: number | null }[] }
  const weightedCounts = ((daySubmissions || []) as DaySubmission[])
    .map((s) => {
      const assets = s.assets || []
      const statics = assets.filter((a) => a.asset_type === 'image').length
      const videos = assets.filter((a) => a.asset_type === 'video')
      return computeWeightedProductivityCount(statics, videos)
    })
    .sort((a, b) => a - b)
  const mid = Math.floor(weightedCounts.length / 2)
  const medianWeightedCount =
    weightedCounts.length === 0
      ? 0
      : weightedCounts.length % 2 !== 0
        ? weightedCounts[mid]
        : (weightedCounts[mid - 1] + weightedCounts[mid]) / 2

  // Fetch time allocation for this submission's user + date
  const { data: allocationData } = await supabase
    .from('time_allocations')
    .select('allocation')
    .eq('user_id', sub.user_id)
    .eq('allocation_date', sub.submission_date)
    .single()
  const allocation = (allocationData as { allocation: string } | null)?.allocation as '0-30' | '30-70' | '70-100' | undefined

  const thisStatics = sub.assets?.filter((a) => a.asset_type === 'image').length || 0
  const thisVideos = sub.assets?.filter((a) => a.asset_type === 'video') || []
  const thisWeightedCount = computeWeightedProductivityCount(thisStatics, thisVideos)
  const suggestedProductivity = computeSuggestedProductivity(thisWeightedCount, medianWeightedCount, allocation)

  return {
    id: sub.id,
    submission_date: sub.submission_date,
    user_id: sub.user_id,
    comment: sub.comment,
    submitterName: sub.profiles?.full_name || 'Unknown',
    imageCount: sub.assets?.filter((a) => a.asset_type === 'image').length || 0,
    videoCount: sub.assets?.filter((a) => a.asset_type === 'video').length || 0,
    assets: sub.assets || [],
    status,
    myRating: myRating || null,
    suggestedProductivity,
    timeAllocation: allocation || null,
    allRatings: (sub.ratings || []).map((r) => ({
      ratedBy: r.profiles?.full_name || 'Unknown',
      productivity: r.productivity,
      quality: r.quality,
      comment: r.comment,
      ratedAt: r.created_at,
    })),
  }
}

export async function submitRating(
  submissionId: string,
  ratings: {
    productivity: number
    quality: number
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const typedProfile = profile as { role: string } | null
  if (typedProfile?.role !== 'admin') {
    return { error: 'Only admins can rate submissions' }
  }

  // Upsert the rating (update if exists, insert if not)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('ratings') as any).upsert(
    {
      submission_id: submissionId,
      rated_by: user.id,
      productivity: ratings.productivity,
      quality: ratings.quality,
    },
    {
      onConflict: 'submission_id,rated_by',
    }
  )

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/judge', 'layout')
  return { success: true }
}

export async function getJudgingStats(date?: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // Build total submissions query — only count completed submissions
  let totalQuery = supabase
    .from('submissions')
    .select('*', { count: 'exact', head: true })
    .eq('is_completed', true)

  if (date) {
    totalQuery = totalQuery.eq('submission_date', date)
  }

  const { count: totalSubmissions } = await totalQuery

  // Build rated submissions query — include submission updated_at and rating created_at
  // Count submissions rated by ANY admin, not just the current user
  let ratedQuery = supabase
    .from('ratings')
    .select('submission_id, created_at, submissions!inner(submission_date, updated_at)')

  if (date) {
    ratedQuery = ratedQuery.eq('submissions.submission_date', date)
  }

  const { data: ratedSubmissions } = await ratedQuery

  type RatedSubmission = {
    submission_id: string
    created_at: string
    submissions: { submission_date: string; updated_at: string | null }
  }

  const typedRated = (ratedSubmissions || []) as unknown as RatedSubmission[]

  // Group ratings by submission_id to find the latest rating per submission
  const ratingsBySubmission = new Map<string, RatedSubmission[]>()
  for (const r of typedRated) {
    const existing = ratingsBySubmission.get(r.submission_id) || []
    existing.push(r)
    ratingsBySubmission.set(r.submission_id, existing)
  }

  // A submission is "fully rated" if it has at least one rating
  // and hasn't been edited after the latest rating
  let fullyRatedCount = 0
  for (const [, ratings] of ratingsBySubmission) {
    const latestRating = ratings.reduce((latest, r) =>
      new Date(r.created_at) > new Date(latest.created_at) ? r : latest
    )
    const updatedAt = latestRating.submissions?.updated_at
    if (!updatedAt || new Date(updatedAt) <= new Date(latestRating.created_at)) {
      fullyRatedCount++
    }
  }

  return {
    total: totalSubmissions || 0,
    rated: fullyRatedCount,
    remaining: (totalSubmissions || 0) - fullyRatedCount,
  }
}

export async function getDesignerSubmissionOverview(date: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const [{ data: designers }, { data: submissions }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['designer', 'admin'])
      .order('full_name'),
    supabase
      .from('submissions')
      .select('user_id')
      .eq('submission_date', date),
  ])

  type Designer = { id: string; full_name: string | null }
  type Submission = { user_id: string }

  const submittedUserIds = new Set(
    ((submissions || []) as Submission[]).map((s) => s.user_id)
  )

  return ((designers || []) as Designer[]).map((d) => ({
    id: d.id,
    name: d.full_name || 'Unknown',
    hasSubmitted: submittedUserIds.has(d.id),
  }))
}

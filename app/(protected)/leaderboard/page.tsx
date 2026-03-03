export const runtime = 'edge'

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardPodium } from '@/components/leaderboard/leaderboard-podium'
import { MatrixChart } from '@/components/matrix/matrix-chart'
import { TimeRangeToggle, type TimeRange } from '@/components/leaderboard/time-range-toggle'
import { WeekNavigator } from '@/components/leaderboard/week-navigator'
import { ViewToggle } from '@/components/leaderboard/view-toggle'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeaderboardEntry } from '@/lib/types/database'

type View = 'table' | 'matrix'

interface LeaderboardPageProps {
  searchParams: Promise<{ range?: TimeRange; week_offset?: string; view?: View }>
}

async function LeaderboardData({
  range,
  isAdmin,
  weekOffset,
}: {
  range: TimeRange
  isAdmin: boolean
  weekOffset: number
}) {
  const supabase = await createClient()

  // Build RPC params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcParams: any = { time_range: range }
  if (range === 'weekly') {
    rpcParams.week_offset = weekOffset
  }

  // Get current period leaderboard
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentLeaderboard } = await (supabase.rpc as any)('get_leaderboard', rpcParams)

  // Get previous period for trend calculation (only for longer ranges)
  let previousLeaderboard = null
  if (range === 'week' || range === 'month') {
    const previousRange = range === 'week' ? 'month' : 'week'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)('get_leaderboard', {
      time_range: previousRange,
    })
    previousLeaderboard = data
  }

  // For weekly view: fetch last business day scores (for "Added" column)
  let lastBizDayLeaderboard = null
  if (range === 'weekly') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)('get_leaderboard', {
      time_range: 'last_business_day',
    })
    lastBizDayLeaderboard = data
  }

  // Fetch avatar paths for all users in the leaderboard
  const userIds = (currentLeaderboard || []).map((e: { user_id: string }) => e.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, avatar_path')
    .in('id', userIds)

  const avatarMap = new Map(
    (profiles || []).map((p: { id: string; avatar_path: string | null }) => [p.id, p.avatar_path])
  )

  // Type the raw data
  type RawLeaderboardEntry = Omit<LeaderboardEntry, 'trend' | 'avatar_path' | 'avg_score_delta' | 'last_day_added'>
  const current: RawLeaderboardEntry[] = currentLeaderboard || []
  const previous: RawLeaderboardEntry[] = previousLeaderboard || []
  const lastBizDay: RawLeaderboardEntry[] = lastBizDayLeaderboard || []

  // Calculate trends by comparing ranks and add avatar paths
  const leaderboardWithTrends: LeaderboardEntry[] = current.map((entry) => {
    const previousEntry = previous.find((p) => p.user_id === entry.user_id)

    let trend: 'up' | 'down' | 'same' = 'same'
    if (previousEntry) {
      if (entry.rank < previousEntry.rank) trend = 'up'
      else if (entry.rank > previousEntry.rank) trend = 'down'
    }

    // Last biz day data: daily scores and asset counts
    let last_day_added: number | undefined
    let daily_static_count: number | undefined
    let daily_video_count: number | undefined
    let daily_avg_productivity: number | undefined
    let daily_avg_quality: number | undefined
    let daily_avg_total: number | undefined
    if (range === 'weekly') {
      const lastDayEntry = lastBizDay.find((p) => p.user_id === entry.user_id)
      if (lastDayEntry) {
        // Always show asset counts for submitters
        daily_static_count = lastDayEntry.static_count
        daily_video_count = lastDayEntry.video_count
        // Only populate score columns if the submission has been rated
        // (avg_total_score > 0 means at least one rating exists; unrated = 0 due to COALESCE)
        if (lastDayEntry.avg_total_score > 0) {
          last_day_added = lastDayEntry.avg_total_score
          daily_avg_productivity = lastDayEntry.avg_productivity
          daily_avg_quality = lastDayEntry.avg_quality
          daily_avg_total = lastDayEntry.avg_total_score
        }
      }
    }

    // Avg score delta: how avg_total_score changed after last submission
    // previous_avg = (cumulative - last_day_added) / (submissions - 1)
    // delta = current_avg - previous_avg
    let avg_score_delta: number | undefined
    if (range === 'weekly' && last_day_added && entry.cumulative_total_score && entry.total_submissions > 1) {
      const previousAvg = (entry.cumulative_total_score - last_day_added) / (entry.total_submissions - 1)
      avg_score_delta = Math.round((entry.avg_total_score - previousAvg) * 10) / 10
    }

    return { ...entry, trend, avatar_path: avatarMap.get(entry.user_id) || null, avg_score_delta, last_day_added, daily_static_count, daily_video_count, daily_avg_productivity, daily_avg_quality, daily_avg_total }
  })

  return (
    <LeaderboardPodium
      entries={leaderboardWithTrends}
      isAdmin={isAdmin}
      currentRange={range}
      weekOffset={weekOffset}
    />
  )
}

async function MatrixData({ range }: { range: TimeRange }) {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leaderboard } = await (supabase.rpc as any)('get_leaderboard', {
    time_range: range,
  })

  // Fetch avatar paths
  const userIds = (leaderboard || []).map((e: { user_id: string }) => e.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, avatar_path')
    .in('id', userIds)

  const avatarMap = new Map(
    (profiles || []).map((p: { id: string; avatar_path: string | null }) => [p.id, p.avatar_path])
  )

  const entries: LeaderboardEntry[] = (leaderboard || []).map(
    (entry: Omit<LeaderboardEntry, 'trend' | 'avatar_path'>) => ({
      ...entry,
      avatar_path: avatarMap.get(entry.user_id) || null,
    })
  )

  return <MatrixChart entries={entries} />
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

function MatrixSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-4 sm:p-8">
      <Skeleton className="w-full aspect-square max-w-[700px] mx-auto rounded-lg" />
    </div>
  )
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = await searchParams
  const view: View = params.view === 'matrix' ? 'matrix' : 'table'
  const range = params.range || (view === 'matrix' ? 'week' : 'weekly')
  const weekOffset = params.week_offset ? parseInt(params.week_offset, 10) : 0

  // Check if user is admin (for download button)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const typedProfile = profile as { role: string } | null
    isAdmin = typedProfile?.role === 'admin'
  }

  const leaderboardTimeOptions = [
    { value: 'weekly' as TimeRange, label: 'Weekly' },
    { value: 'last_business_day' as TimeRange, label: 'Last Biz Day' },
    { value: 'all' as TimeRange, label: 'Total' },
  ]

  const matrixTimeOptions = [
    { value: 'today' as TimeRange, label: 'Today' },
    { value: 'yesterday' as TimeRange, label: 'Yesterday' },
    { value: 'last_business_day' as TimeRange, label: 'Last Biz Day' },
    { value: 'weekly' as TimeRange, label: 'Weekly' },
    { value: 'week' as TimeRange, label: 'Last 7 Days' },
    { value: 'month' as TimeRange, label: 'Last 30 Days' },
  ]

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {view === 'matrix' ? 'Performance Matrix' : 'Leaderboard'}
            </h1>
            <p className="text-gray-600 mt-1">
              {view === 'matrix'
                ? 'Productivity vs. Quality across all designers'
                : 'See how designers rank based on their submissions'}
            </p>
          </div>
          <ViewToggle currentView={view} />
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <TimeRangeToggle
            currentRange={range}
            options={view === 'matrix' ? matrixTimeOptions : leaderboardTimeOptions}
          />
          {view === 'table' && range === 'weekly' && (
            <WeekNavigator weekOffset={weekOffset} />
          )}
        </div>
      </div>

      {view === 'matrix' ? (
        <Suspense fallback={<MatrixSkeleton />}>
          <MatrixData range={range} />
        </Suspense>
      ) : (
        <Suspense fallback={<LeaderboardSkeleton />}>
          <LeaderboardData range={range} isAdmin={isAdmin} weekOffset={weekOffset} />
        </Suspense>
      )}
    </div>
  )
}

export const runtime = 'edge'

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { LeaderboardPodium } from '@/components/leaderboard/leaderboard-podium'
import { WeeklyLeaderboard } from '@/components/leaderboard/weekly-leaderboard'
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

function getWeekDays(weekOffset: number): { date: string; label: string }[] {
  const today = new Date()
  const dow = today.getDay()
  const daysSinceFriday = ((dow - 5) + 7) % 7
  const friday = new Date(today)
  friday.setDate(friday.getDate() - daysSinceFriday + (weekOffset * 7))

  // Week order: Fri, Mon, Tue, Wed, Thu
  const offsets = [0, 3, 4, 5, 6] // days after Friday
  const dayLabels = ['Fri', 'Mon', 'Tue', 'Wed', 'Thu']

  return offsets.map((offset, i) => {
    const d = new Date(friday)
    d.setDate(d.getDate() + offset)
    return {
      date: d.toISOString().split('T')[0],
      label: `${dayLabels[i]} ${d.getDate()}`
    }
  }).filter(d => new Date(d.date) <= today) // hide future days
}

function getWeekStartEnd(weekOffset: number): { start: string; end: string } {
  const today = new Date()
  const dow = today.getDay()
  const daysSinceFriday = ((dow - 5) + 7) % 7
  const friday = new Date(today)
  friday.setDate(friday.getDate() - daysSinceFriday + (weekOffset * 7))
  const thursday = new Date(friday)
  thursday.setDate(thursday.getDate() + 6)
  return {
    start: friday.toISOString().split('T')[0],
    end: thursday.toISOString().split('T')[0],
  }
}

async function WeeklyLeaderboardData({
  weekOffset,
  isAdmin,
}: {
  weekOffset: number
  isAdmin: boolean
}) {
  const supabase = await createClient()
  const weekDays = getWeekDays(weekOffset)
  const { start: weekStartDate, end: weekEndDate } = getWeekStartEnd(weekOffset)

  // Parallel RPC calls: one per visible day + one for full week
  const dayPromises = weekDays.map((day) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)('get_leaderboard', {
      time_range: 'daily',
      target_date: day.date,
    })
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weeklyPromise = (supabase.rpc as any)('get_leaderboard', {
    time_range: 'weekly',
    week_offset: weekOffset,
  })

  const [weeklyResult, ...dayResults] = await Promise.all([weeklyPromise, ...dayPromises])

  // Collect all user IDs for avatar fetching
  const allUserIds = new Set<string>()
  const weeklyData = weeklyResult.data || []
  weeklyData.forEach((e: { user_id: string }) => allUserIds.add(e.user_id))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dayDataArrays = dayResults.map((r: any) => (r.data || []) as LeaderboardEntry[])
  dayDataArrays.forEach((arr) =>
    arr.forEach((e) => allUserIds.add(e.user_id))
  )

  // Fetch avatars
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, avatar_path')
    .in('id', Array.from(allUserIds))

  const avatarMap = new Map(
    (profiles || []).map((p: { id: string; avatar_path: string | null }) => [p.id, p.avatar_path])
  )

  // Helper to add avatar_path to entries
  const addAvatars = (entries: LeaderboardEntry[]): LeaderboardEntry[] =>
    entries.map((e) => ({ ...e, avatar_path: avatarMap.get(e.user_id) || null }))

  // Build week days with entries
  const weekDaysWithEntries = weekDays.map((day, i) => ({
    ...day,
    entries: addAvatars(dayDataArrays[i] || []),
  }))

  const weeklyEntries = addAvatars(weeklyData)

  return (
    <WeeklyLeaderboard
      weekDays={weekDaysWithEntries}
      weeklyEntries={weeklyEntries}
      weekOffset={weekOffset}
      isAdmin={isAdmin}
      weekStartDate={weekStartDate}
      weekEndDate={weekEndDate}
    />
  )
}

async function TotalLeaderboardData({ isAdmin }: { isAdmin: boolean }) {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentLeaderboard } = await (supabase.rpc as any)('get_leaderboard', {
    time_range: 'all',
  })

  const userIds = (currentLeaderboard || []).map((e: { user_id: string }) => e.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, avatar_path')
    .in('id', userIds)

  const avatarMap = new Map(
    (profiles || []).map((p: { id: string; avatar_path: string | null }) => [p.id, p.avatar_path])
  )

  const entries: LeaderboardEntry[] = (currentLeaderboard || []).map(
    (entry: LeaderboardEntry) => ({
      ...entry,
      avatar_path: avatarMap.get(entry.user_id) || null,
    })
  )

  return <LeaderboardPodium entries={entries} isAdmin={isAdmin} />
}

async function MatrixData({ range }: { range: TimeRange }) {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leaderboard } = await (supabase.rpc as any)('get_leaderboard', {
    time_range: range,
  })

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

  // Check if user is admin
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
      ) : range === 'weekly' ? (
        <Suspense fallback={<LeaderboardSkeleton />}>
          <WeeklyLeaderboardData weekOffset={weekOffset} isAdmin={isAdmin} />
        </Suspense>
      ) : (
        <Suspense fallback={<LeaderboardSkeleton />}>
          <TotalLeaderboardData isAdmin={isAdmin} />
        </Suspense>
      )}
    </div>
  )
}

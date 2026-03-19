export const runtime = 'edge'

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { WeeklyLeaderboard } from '@/components/leaderboard/weekly-leaderboard'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeaderboardEntry } from '@/lib/types/database'

interface LeaderboardPageProps {
  searchParams: Promise<{ week_offset?: string }>
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

  const addAvatars = (entries: LeaderboardEntry[]): LeaderboardEntry[] =>
    entries.map((e) => ({ ...e, avatar_path: avatarMap.get(e.user_id) || null }))

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

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = await searchParams
  const weekOffset = params.week_offset ? parseInt(params.week_offset, 10) : 0

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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
        <p className="text-gray-600 mt-1">See how designers rank based on their submissions</p>
      </div>

      <Suspense fallback={<LeaderboardSkeleton />}>
        <WeeklyLeaderboardData weekOffset={weekOffset} isAdmin={isAdmin} />
      </Suspense>
    </div>
  )
}

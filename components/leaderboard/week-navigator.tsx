'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WeekNavigatorProps {
  weekOffset: number
}

function getWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) return 'This Week'
  if (weekOffset === -1) return 'Last Week'
  const today = new Date()
  const dow = today.getDay()
  const daysSinceFriday = ((dow - 5) + 7) % 7
  const friday = new Date(today)
  friday.setDate(friday.getDate() - daysSinceFriday + (weekOffset * 7))
  const thursday = new Date(friday)
  thursday.setDate(thursday.getDate() + 6)
  const endDate = thursday > today ? today : thursday
  return `${format(friday, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`
}

export function WeekNavigator({ weekOffset }: WeekNavigatorProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const navigate = (newOffset: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newOffset === 0) {
      params.delete('week_offset')
    } else {
      params.set('week_offset', newOffset.toString())
    }
    router.push(`/leaderboard?${params.toString()}`)
  }

  const canGoForward = weekOffset < 0

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(weekOffset - 1)}
        className="h-8 w-8"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center">
        {getWeekLabel(weekOffset)}
      </span>

      <Button
        variant="outline"
        size="icon"
        onClick={() => navigate(weekOffset + 1)}
        disabled={!canGoForward}
        className="h-8 w-8"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

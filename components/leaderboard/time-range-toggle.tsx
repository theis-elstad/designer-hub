'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type TimeRange = 'today' | 'yesterday' | 'last_business_day' | 'daily' | 'weekly' | 'week' | 'month' | 'all'

type TimeRangeOption = { value: TimeRange; label: string }

const defaultOptions: TimeRangeOption[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_business_day', label: 'Last Biz Day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'week', label: 'Last 7 Days' },
  { value: 'month', label: 'Last 30 Days' },
]

interface TimeRangeToggleProps {
  currentRange: TimeRange
  basePath?: string
  options?: TimeRangeOption[]
}

export function TimeRangeToggle({ currentRange, basePath = '/leaderboard', options = defaultOptions }: TimeRangeToggleProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('range', value)
    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <Tabs value={currentRange} onValueChange={handleChange}>
      <TabsList>
        {options.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value}>{opt.label}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

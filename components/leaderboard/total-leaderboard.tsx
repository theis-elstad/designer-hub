'use client'

import { useState, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LeaderboardPodium } from './leaderboard-podium'
import { MatrixChart } from '@/components/matrix/matrix-chart'
import { DownloadMenu } from './download-menu'
import { TimeRangeToggle, type TimeRange } from '@/components/leaderboard/time-range-toggle'
import type { LeaderboardEntry } from '@/lib/types/database'

interface TotalLeaderboardProps {
  entries: LeaderboardEntry[]
  isAdmin: boolean
}

const timeOptions = [
  { value: 'weekly' as TimeRange, label: 'Weekly' },
  { value: 'all' as TimeRange, label: 'Total' },
]

export function TotalLeaderboard({ entries, isAdmin }: TotalLeaderboardProps) {
  const [activeTab, setActiveTab] = useState('leaderboard')
  const listRef = useRef<HTMLDivElement>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <TimeRangeToggle currentRange="all" options={timeOptions} />
        <div className="flex-1" />
        {isAdmin && (
          <DownloadMenu listRef={listRef} filePrefix="leaderboard-total" />
        )}
      </div>

      <div ref={listRef} className="bg-white rounded-lg overflow-hidden">
        {/* Banner */}
        <div className="px-4 sm:px-6 py-4 bg-gray-900 text-white">
          <h2 className="text-lg font-bold">Designer Hub Leaderboard</h2>
          <p className="text-sm text-gray-300">All Time</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-4 sm:px-6 pt-3 bg-gray-50 border-b">
            <TabsList>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
              <TabsTrigger value="matrix">Matrix</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="leaderboard" className="mt-0">
            <LeaderboardPodium entries={entries} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="matrix" className="mt-0 p-4 sm:p-6">
            <MatrixChart entries={entries} mode="avg" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

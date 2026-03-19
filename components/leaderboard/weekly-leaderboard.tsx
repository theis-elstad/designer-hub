'use client'

import { useState, useRef, useCallback } from 'react'
import { format, getISOWeek } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DayLeaderboardTable } from './day-leaderboard-table'
import { WeeklyWinnerTable } from './weekly-winner-table'
import { DesignerGalleryDialog } from './designer-gallery-dialog'
import { DownloadMenu } from './download-menu'
import { WeekNavigator } from '@/components/leaderboard/week-navigator'
import { MatrixChart } from '@/components/matrix/matrix-chart'
import type { LeaderboardEntry } from '@/lib/types/database'

type ViewMode = 'list' | 'matrix'

interface WeekDay {
  date: string
  label: string
  entries: LeaderboardEntry[]
}

interface WeeklyLeaderboardProps {
  weekDays: WeekDay[]
  weeklyEntries: LeaderboardEntry[]
  weekOffset: number
  isAdmin: boolean
  weekStartDate: string
  weekEndDate: string
}

function getWeekRangeLabel(weekOffset: number): string {
  const today = new Date()
  const dow = today.getDay()
  const daysSinceFriday = ((dow - 5) + 7) % 7
  const friday = new Date(today)
  friday.setDate(friday.getDate() - daysSinceFriday + (weekOffset * 7))
  const thursday = new Date(friday)
  thursday.setDate(thursday.getDate() + 6)
  const weekNum = getISOWeek(thursday)
  const sameMonth = friday.getMonth() === thursday.getMonth()
  const dateRange = sameMonth
    ? `${format(friday, 'MMM d')} - ${format(thursday, 'd')}`
    : `${format(friday, 'MMM d')} - ${format(thursday, 'MMM d')}`
  return `Week ${weekNum} (${dateRange})`
}

export function WeeklyLeaderboard({
  weekDays,
  weeklyEntries,
  weekOffset,
  isAdmin,
  weekStartDate,
  weekEndDate,
}: WeeklyLeaderboardProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')

  // Gallery dialog state
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryUserId, setGalleryUserId] = useState('')
  const [galleryDesignerName, setGalleryDesignerName] = useState('')
  const [galleryStartDate, setGalleryStartDate] = useState('')
  const [galleryEndDate, setGalleryEndDate] = useState('')

  // Default tab: most recent day with entries, or 'ww'
  const defaultTab = (() => {
    for (let i = weekDays.length - 1; i >= 0; i--) {
      if (weekDays[i].entries.length > 0) return weekDays[i].date
    }
    return 'ww'
  })()

  const [listTab, setListTab] = useState(defaultTab)
  const [matrixTab, setMatrixTab] = useState(defaultTab)

  const openGallery = useCallback((userId: string, designerName: string, startDate: string, endDate: string) => {
    setGalleryUserId(userId)
    setGalleryDesignerName(designerName)
    setGalleryStartDate(startDate)
    setGalleryEndDate(endDate)
    setGalleryOpen(true)
  }, [])

  const handleDayAssetClick = useCallback((date: string) => (userId: string, designerName: string) => {
    openGallery(userId, designerName, date, date)
  }, [openGallery])

  const handleWeekAssetClick = useCallback((userId: string, designerName: string) => {
    openGallery(userId, designerName, weekStartDate, weekEndDate)
  }, [openGallery, weekStartDate, weekEndDate])

  const activeTab = viewMode === 'list' ? listTab : matrixTab
  const setActiveTab = viewMode === 'list' ? setListTab : setMatrixTab

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center justify-between gap-4">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="matrix">Matrix</TabsTrigger>
          </TabsList>
        </Tabs>
        <WeekNavigator weekOffset={weekOffset} />
        {isAdmin && (
          <DownloadMenu listRef={listRef} filePrefix={`leaderboard-${activeTab}`} />
        )}
      </div>

      <div ref={listRef} className="bg-white rounded-lg overflow-hidden">
        {/* Banner */}
        <div className="px-4 sm:px-6 py-4 bg-gray-900 text-white">
          <h2 className="text-lg font-bold">Designer Hub Leaderboard</h2>
          <p className="text-sm text-gray-300">{getWeekRangeLabel(weekOffset)}</p>
        </div>

        {/* List View */}
        {viewMode === 'list' && (
          <Tabs value={listTab} onValueChange={setListTab} className="gap-0">
            <div className="pl-0 pr-4 sm:pr-6 py-2 bg-gray-50 border-b">
              <TabsList>
                {weekDays.map((day) => (
                  <TabsTrigger key={day.date} value={day.date}>
                    {day.label}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="ww" className="text-amber-700 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900">
                  Weekly Total
                </TabsTrigger>
              </TabsList>
            </div>

            {weekDays.map((day) => (
              <TabsContent key={day.date} value={day.date} className="mt-0">
                <DayLeaderboardTable
                  entries={day.entries}
                  date={day.date}
                  onAssetClick={handleDayAssetClick(day.date)}
                />
              </TabsContent>
            ))}

            <TabsContent value="ww" className="mt-0">
              <WeeklyWinnerTable
                entries={weeklyEntries}
                onAssetClick={handleWeekAssetClick}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Matrix View */}
        {viewMode === 'matrix' && (
          <Tabs value={matrixTab} onValueChange={setMatrixTab} className="gap-0">
            <div className="pl-0 pr-4 sm:pr-6 py-2 bg-gray-50 border-b">
              <TabsList>
                {weekDays.map((day) => (
                  <TabsTrigger key={day.date} value={day.date}>
                    {day.label}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="ww" className="text-amber-700 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900">
                  Weekly Total
                </TabsTrigger>
                <TabsTrigger value="avg" className="text-amber-700 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900">
                  Average
                </TabsTrigger>
              </TabsList>
            </div>

            {weekDays.map((day) => (
              <TabsContent key={day.date} value={day.date} className="mt-0 p-2 sm:p-4">
                <MatrixChart
                  entries={day.entries}
                  mode="avg"
                />
              </TabsContent>
            ))}

            <TabsContent value="ww" className="mt-0 p-2 sm:p-4">
              <MatrixChart
                entries={weeklyEntries}
                mode="cumulative"
                weekDays={weekDays}
              />
            </TabsContent>

            <TabsContent value="avg" className="mt-0 p-2 sm:p-4">
              <MatrixChart
                entries={weeklyEntries}
                mode="avg"
              />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <DesignerGalleryDialog
        designerName={galleryDesignerName}
        userId={galleryUserId}
        startDate={galleryStartDate}
        endDate={galleryEndDate}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  )
}

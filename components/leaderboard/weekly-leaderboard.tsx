'use client'

import { useState, useRef, useCallback } from 'react'
import { format, getISOWeek } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DayLeaderboardTable } from './day-leaderboard-table'
import { WeeklyWinnerTable } from './weekly-winner-table'
import { DesignerGalleryDialog } from './designer-gallery-dialog'
import { DownloadMenu } from './download-menu'
import { HorseRaceChart } from './horse-race-chart'
import type { LeaderboardEntry } from '@/lib/types/database'

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

  const [activeTab, setActiveTab] = useState(defaultTab)

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

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <DownloadMenu listRef={listRef} filePrefix={`leaderboard-${activeTab}`} />
        </div>
      )}

      <div ref={listRef} className="bg-white rounded-lg overflow-hidden">
        {/* Banner */}
        <div className="px-4 sm:px-6 py-4 bg-gray-900 text-white">
          <h2 className="text-lg font-bold">Designer Hub Leaderboard</h2>
          <p className="text-sm text-gray-300">{getWeekRangeLabel(weekOffset)}</p>
        </div>

        {/* Day tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="px-4 sm:px-6 pt-3 bg-gray-50 border-b">
            <TabsList>
              {weekDays.map((day) => (
                <TabsTrigger key={day.date} value={day.date}>
                  {day.label}
                </TabsTrigger>
              ))}
              <TabsTrigger value="ww">Weekly Total</TabsTrigger>
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
            <div className="p-4 sm:p-6 space-y-6">
              <HorseRaceChart weekDays={weekDays} weeklyEntries={weeklyEntries} />
            </div>
            <WeeklyWinnerTable
              entries={weeklyEntries}
              onAssetClick={handleWeekAssetClick}
            />
          </TabsContent>
        </Tabs>
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

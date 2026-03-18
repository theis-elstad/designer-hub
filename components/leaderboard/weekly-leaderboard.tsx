'use client'

import { useState, useRef, useCallback } from 'react'
import { format, getISOWeek } from 'date-fns'
import { Download, EyeOff, ScissorsLineDashed } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { DayLeaderboardTable } from './day-leaderboard-table'
import { WeeklyWinnerTable } from './weekly-winner-table'
import { DesignerGalleryDialog } from './designer-gallery-dialog'
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

  const handleDownload = useCallback(async () => {
    if (!listRef.current) return
    try {
      const htmlToImage = await import('html-to-image')
      const dataUrl = await htmlToImage.toPng(listRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `leaderboard-${activeTab}-${new Date().toISOString().split('T')[0]}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Failed to download leaderboard image:', error)
    }
  }, [activeTab])

  const handleAnonymousDownload = useCallback(async () => {
    if (!listRef.current) return
    const rows = listRef.current.querySelectorAll<HTMLElement>('[data-rank]')
    const totalRows = rows.length
    const blurFrom = Math.ceil(totalRows / 2)
    const blurred: { el: HTMLElement; prev: string }[] = []

    rows.forEach((row, index) => {
      if (index >= blurFrom) {
        row.querySelectorAll<HTMLElement>('[data-anon="blur"]').forEach((el) => {
          blurred.push({ el, prev: el.style.filter })
          el.style.filter = 'blur(12px)'
        })
      }
    })

    try {
      const htmlToImage = await import('html-to-image')
      const dataUrl = await htmlToImage.toPng(listRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `leaderboard-anon-${activeTab}-${new Date().toISOString().split('T')[0]}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Failed to download anonymous leaderboard image:', error)
    } finally {
      blurred.forEach(({ el, prev }) => { el.style.filter = prev })
    }
  }, [activeTab])

  const handleTopHalfDownload = useCallback(async () => {
    if (!listRef.current) return
    const rows = listRef.current.querySelectorAll<HTMLElement>('[data-rank]')
    const totalRows = rows.length
    const hideFrom = Math.ceil(totalRows / 2)
    const hidden: { el: HTMLElement; prev: string }[] = []

    rows.forEach((row, index) => {
      if (index >= hideFrom) {
        hidden.push({ el: row, prev: row.style.display })
        row.style.display = 'none'
      }
    })

    try {
      const htmlToImage = await import('html-to-image')
      const dataUrl = await htmlToImage.toPng(listRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 })
      const link = document.createElement('a')
      link.download = `leaderboard-top-half-${activeTab}-${new Date().toISOString().split('T')[0]}.png`
      link.href = dataUrl
      link.click()
    } catch (error) {
      console.error('Failed to download top-half leaderboard image:', error)
    } finally {
      hidden.forEach(({ el, prev }) => { el.style.display = prev })
    }
  }, [activeTab])

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleAnonymousDownload} title="Download with non-podium rows blurred">
            <EyeOff className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleTopHalfDownload} title="Download top half only">
            <ScissorsLineDashed className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
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
              <TabsTrigger value="ww">WW</TabsTrigger>
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

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DownloadMenuProps {
  listRef: React.RefObject<HTMLDivElement | null>
  filePrefix?: string
}

export function DownloadMenu({ listRef, filePrefix = 'leaderboard' }: DownloadMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const dateSuffix = new Date().toISOString().split('T')[0]

  const downloadPng = useCallback(async (el: HTMLElement, filename: string) => {
    const htmlToImage = await import('html-to-image')
    const dataUrl = await htmlToImage.toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2 })
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }, [])

  const handleAll = useCallback(async () => {
    setOpen(false)
    if (!listRef.current) return
    try {
      await downloadPng(listRef.current, `${filePrefix}-${dateSuffix}.png`)
    } catch (error) {
      console.error('Failed to download:', error)
    }
  }, [listRef, filePrefix, dateSuffix, downloadPng])

  const handleTopHalf = useCallback(async () => {
    setOpen(false)
    if (!listRef.current) return
    const rows = listRef.current.querySelectorAll<HTMLElement>('[data-rank]')
    const hideFrom = Math.ceil(rows.length / 2)
    const hidden: { el: HTMLElement; prev: string }[] = []

    rows.forEach((row, index) => {
      if (index >= hideFrom) {
        hidden.push({ el: row, prev: row.style.display })
        row.style.display = 'none'
      }
    })

    try {
      await downloadPng(listRef.current, `${filePrefix}-top50-${dateSuffix}.png`)
    } catch (error) {
      console.error('Failed to download:', error)
    } finally {
      hidden.forEach(({ el, prev }) => { el.style.display = prev })
    }
  }, [listRef, filePrefix, dateSuffix, downloadPng])

  const handleTop10 = useCallback(async () => {
    setOpen(false)
    if (!listRef.current) return
    const rows = listRef.current.querySelectorAll<HTMLElement>('[data-rank]')
    const hidden: { el: HTMLElement; prev: string }[] = []

    rows.forEach((row, index) => {
      if (index >= 10) {
        hidden.push({ el: row, prev: row.style.display })
        row.style.display = 'none'
      }
    })

    try {
      await downloadPng(listRef.current, `${filePrefix}-top10-${dateSuffix}.png`)
    } catch (error) {
      console.error('Failed to download:', error)
    } finally {
      hidden.forEach(({ el, prev }) => { el.style.display = prev })
    }
  }, [listRef, filePrefix, dateSuffix, downloadPng])

  return (
    <div className="relative" ref={menuRef}>
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
        <Download className="h-4 w-4 mr-2" />
        Download
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-md border shadow-lg z-50 py-1">
          <button onClick={handleAll} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100">
            All
          </button>
          <button onClick={handleTopHalf} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100">
            Top 50%
          </button>
          <button onClick={handleTop10} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100">
            Top 10
          </button>
        </div>
      )}
    </div>
  )
}

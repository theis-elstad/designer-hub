'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { getDesignerGallery } from '@/lib/actions/ratings'
import { AssetReviewForm } from './asset-review-form'

interface DesignerGalleryDialogProps {
  designerName: string
  userId: string
  startDate: string
  endDate: string
  isOpen: boolean
  onClose: () => void
}

function isVideoFile(fileName: string) {
  return /\.(mp4|mov|webm|avi)$/i.test(fileName)
}

export function DesignerGalleryDialog({
  designerName,
  userId,
  startDate,
  endDate,
  isOpen,
  onClose,
}: DesignerGalleryDialogProps) {
  const [assets, setAssets] = useState<{ id: string; signedUrl: string; fileName: string; assetType: string; duration: number | null; submissionDate: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen && userId && startDate && endDate) {
      setLoading(true)
      setAssets([])
      setSelectedIndex(null)
      getDesignerGallery(userId, startDate, endDate)
        .then(setAssets)
        .finally(() => setLoading(false))
    }
  }, [isOpen, userId, startDate, endDate])

  // Reset to grid when dialog closes
  useEffect(() => {
    if (!isOpen) setSelectedIndex(null)
  }, [isOpen])

  const goToPrev = useCallback(() => {
    if (selectedIndex === null) return
    setSelectedIndex(selectedIndex === 0 ? assets.length - 1 : selectedIndex - 1)
  }, [selectedIndex, assets.length])

  const goToNext = useCallback(() => {
    if (selectedIndex === null) return
    setSelectedIndex(selectedIndex === assets.length - 1 ? 0 : selectedIndex + 1)
  }, [selectedIndex, assets.length])

  // Keyboard navigation in enlarged view
  useEffect(() => {
    if (!isOpen || selectedIndex === null) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrev()
      if (e.key === 'ArrowRight') goToNext()
      if (e.key === 'Backspace' || e.key === 'Escape') {
        e.preventDefault()
        setSelectedIndex(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, goToPrev, goToNext])

  const dateLabel = startDate === endDate
    ? new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : `${new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const currentAsset = selectedIndex !== null ? assets[selectedIndex] : null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          {selectedIndex !== null ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setSelectedIndex(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle>
                {designerName}&apos;s Ads - {dateLabel}
                <span className="text-gray-400 font-normal text-sm ml-2">
                  {selectedIndex + 1} of {assets.length}
                </span>
              </DialogTitle>
            </div>
          ) : (
            <DialogTitle>{designerName}&apos;s Ads - {dateLabel}</DialogTitle>
          )}
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No assets found.</div>
        ) : selectedIndex !== null && currentAsset ? (
          /* Enlarged single asset view */
          <div className="space-y-0">
            <div className="relative">
              <div className="flex items-center justify-center min-h-[300px]">
                {currentAsset.assetType === 'video' || isVideoFile(currentAsset.fileName) ? (
                  <video
                    key={currentAsset.signedUrl}
                    src={currentAsset.signedUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-[50vh] object-contain rounded-lg"
                  />
                ) : (
                  <img
                    src={currentAsset.signedUrl}
                    alt={currentAsset.fileName}
                    className="max-w-full max-h-[50vh] object-contain rounded-lg"
                  />
                )}
              </div>

              {/* Prev/Next navigation */}
              {assets.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 hover:bg-white"
                    onClick={goToPrev}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/80 hover:bg-white"
                    onClick={goToNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {/* Peer review form */}
            <AssetReviewForm key={currentAsset.id} assetId={currentAsset.id} />
          </div>
        ) : (
          /* Grid view */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {assets.map((asset, index) => {
              const isVideo = asset.assetType === 'video' || isVideoFile(asset.fileName)

              return (
                <button
                  key={asset.id}
                  onClick={() => setSelectedIndex(index)}
                  className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-blue-500 transition-all relative"
                >
                  {isVideo ? (
                    <>
                      <video src={asset.signedUrl} className="w-full h-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                          <Play className="h-6 w-6 text-white ml-1" fill="white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={asset.signedUrl} alt={asset.fileName} className="w-full h-full object-cover" />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

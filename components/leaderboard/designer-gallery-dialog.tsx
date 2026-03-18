'use client'

import { useState, useEffect } from 'react'
import { Play } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { MediaPreviewModal, type MediaItem } from '@/components/ui/media-preview-modal'
import { getDesignerGallery } from '@/lib/actions/ratings'

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
      getDesignerGallery(userId, startDate, endDate)
        .then(setAssets)
        .finally(() => setLoading(false))
    }
  }, [isOpen, userId, startDate, endDate])

  const dateLabel = startDate === endDate
    ? new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : `${new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const mediaItems: MediaItem[] = assets.map((asset) => ({
    url: asset.signedUrl,
    name: asset.fileName,
    type: isVideoFile(asset.fileName) ? 'video' : 'image',
  }))

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{designerName}&apos;s Ads - {dateLabel}</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No assets found.</div>
          ) : (
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

      <MediaPreviewModal
        items={mediaItems}
        initialIndex={selectedIndex ?? 0}
        isOpen={selectedIndex !== null}
        onClose={() => setSelectedIndex(null)}
      />
    </>
  )
}

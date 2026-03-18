'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Play } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { deleteAsset } from '@/lib/actions/submissions'
import type { Asset } from '@/lib/types/database'
import {
  MediaPreviewModal,
  isVideoFile,
  type MediaItem,
} from '@/components/ui/media-preview-modal'

interface ExistingAssetsProps {
  assets: Asset[]
  onAssetDeleted?: (assetId: string) => void
}

export function ExistingAssets({ assets: initialAssets, onAssetDeleted }: ExistingAssetsProps) {
  const [assets, setAssets] = useState(initialAssets)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const supabase = createClient()

  // Sync local state when parent passes new assets (e.g. date change)
  useEffect(() => {
    setAssets(initialAssets)
    setSignedUrls({})
    setPreviewIndex(null)
  }, [initialAssets])

  // Generate signed URLs for all assets
  useEffect(() => {
    async function getSignedUrls() {
      const urls: Record<string, string> = {}
      for (const asset of assets) {
        const { data } = await supabase.storage
          .from('submissions')
          .createSignedUrl(asset.storage_path, 3600) // 1 hour expiry
        if (data?.signedUrl) {
          urls[asset.storage_path] = data.signedUrl
        }
      }
      setSignedUrls(urls)
    }
    if (assets.length > 0) {
      getSignedUrls()
    }
  }, [assets, supabase])

  const getMediaUrl = (storagePath: string) => {
    return signedUrls[storagePath] || ''
  }

  const handleDelete = async (asset: Asset) => {
    setDeletingId(asset.id)
    const result = await deleteAsset(asset.id, asset.storage_path)
    if (result.success) {
      setAssets((prev) => prev.filter((a) => a.id !== asset.id))
      onAssetDeleted?.(asset.id)
    }
    setDeletingId(null)
  }

  if (assets.length === 0) return null

  const mediaItems: MediaItem[] = assets.map((asset) => ({
    url: getMediaUrl(asset.storage_path),
    name: asset.file_name,
    type: isVideoFile(asset.file_name) ? 'video' : 'image',
  }))

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">
        Submissions ({assets.length})
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {assets.map((asset, index) => {
          const isVideo = isVideoFile(asset.file_name)
          const mediaUrl = getMediaUrl(asset.storage_path)

          return (
            <div
              key={asset.id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer"
              onClick={() => mediaUrl && setPreviewIndex(index)}
            >
              {mediaUrl && (
                <>
                  {isVideo ? (
                    <>
                      <video
                        src={mediaUrl}
                        className="w-full h-full object-cover"
                        muted
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                          <Play className="h-6 w-6 text-white ml-1" fill="white" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={asset.file_name}
                      className="w-full h-full object-cover"
                    />
                  )}
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(asset)
                }}
                disabled={deletingId === asset.id}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                {deletingId === asset.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-xs text-white truncate">{asset.file_name}</p>
              </div>
            </div>
          )
        })}
      </div>

      <MediaPreviewModal
        items={mediaItems}
        initialIndex={previewIndex ?? 0}
        isOpen={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
      />
    </div>
  )
}

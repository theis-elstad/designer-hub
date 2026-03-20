'use client'

import { useState, useEffect, useCallback } from 'react'
import { Star, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { getAssetReview, submitAssetReview } from '@/lib/actions/asset-reviews'

interface AssetReviewFormProps {
  assetId: string
}

export function AssetReviewForm({ assetId }: AssetReviewFormProps) {
  const [stars, setStars] = useState(0)
  const [hoveredStar, setHoveredStar] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)

  const loadReview = useCallback(async () => {
    setLoading(true)
    setSaved(false)
    const review = await getAssetReview(assetId)
    if (review) {
      setStars(review.stars)
      setComment(review.comment || '')
      setHasExisting(true)
    } else {
      setStars(0)
      setComment('')
      setHasExisting(false)
    }
    setLoading(false)
  }, [assetId])

  useEffect(() => {
    loadReview()
  }, [loadReview])

  const handleSubmit = async () => {
    if (stars === 0) return
    setSaving(true)
    const result = await submitAssetReview(assetId, stars, comment || null)
    setSaving(false)
    if (result.success) {
      setSaved(true)
      setHasExisting(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )
  }

  const displayStars = hoveredStar || stars

  return (
    <div className="border-t pt-4 mt-2 space-y-3 text-center">
      <div>
        <p className="text-sm font-medium text-gray-700">Help us improve the rating algorithm</p>
        {hasExisting && !saved && (
          <span className="text-xs text-gray-400">Your review</span>
        )}
        {saved && (
          <span className="text-xs text-green-600 inline-flex items-center gap-1 justify-center">
            <Check className="h-3 w-3" /> Saved
          </span>
        )}
      </div>

      {/* Stars */}
      <div className="flex items-center justify-center gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStars(i)}
            onMouseEnter={() => setHoveredStar(i)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-0.5 cursor-pointer transition-transform hover:scale-110"
          >
            <Star
              className={cn(
                'h-6 w-6 transition-colors',
                i <= displayStars
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-gray-300'
              )}
            />
          </button>
        ))}
        {stars > 0 && (
          <span className="text-sm text-gray-500 ml-2">{stars}/5</span>
        )}
      </div>

      {/* Comment */}
      <Textarea
        placeholder="What makes this good or bad? (anonymous)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        className="text-sm resize-none text-center placeholder:text-center"
      />

      {/* Submit */}
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={stars === 0 || saving}
        className="w-full"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : null}
        {hasExisting ? 'Update Review' : 'Submit Review'}
      </Button>
    </div>
  )
}

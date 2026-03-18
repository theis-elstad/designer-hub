'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { Image, Video, CheckCircle, Pencil, MessageSquare, Trash2, Loader2, Star, User } from 'lucide-react'
import { toast } from 'sonner'
import { SubmissionGallery } from './submission-gallery'
import { RatingForm } from './rating-form'
import { AIContextPanel } from './ai-context-panel'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SubmissionDetailProps {
  submission: {
    id: string
    submission_date: string
    user_id: string
    submitterName: string
    comment?: string | null
    imageCount: number
    videoCount: number
    status: 'needs_review' | 'rated' | 'edited'
    myRating: {
      productivity: number
      quality: number
      comment?: string | null
    } | null
    assets: {
      id: string
      storage_path: string
      file_name: string
    }[]
    suggestedProductivity?: number
    timeAllocation?: string | null
    allRatings?: {
      ratedBy: string
      productivity: number
      quality: number
      comment?: string | null
      ratedAt: string
    }[]
  }
}

export function SubmissionDetail({ submission }: SubmissionDetailProps) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const date = new Date(submission.submission_date + 'T00:00:00')

  const handleRated = () => {
    router.refresh()
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch('/api/submissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submission.id }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        toast.error(result.error || 'Failed to delete submission')
      } else {
        toast.success('Submission deleted')
        router.push('/judge')
      }
    } catch {
      toast.error('Failed to delete submission')
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {submission.status === 'needs_review' ? 'Anonymous Designer' : submission.submitterName}
          </h2>
          <p className="text-gray-500 mt-1">{format(date, 'EEEE, MMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-3">
          {submission.imageCount > 0 && (
            <Badge variant="outline" className="gap-1.5">
              <Image className="h-3.5 w-3.5" />
              {submission.imageCount} static
            </Badge>
          )}
          {submission.videoCount > 0 && (
            <Badge variant="outline" className="gap-1.5">
              <Video className="h-3.5 w-3.5" />
              {submission.videoCount} video
            </Badge>
          )}
          {submission.timeAllocation && (
            <Badge variant="outline" className="gap-1.5 bg-purple-50 text-purple-700 border-purple-200">
              Ad time: {submission.timeAllocation === '0-30' ? '<30%' : submission.timeAllocation === '30-70' ? '30-70%' : '70-100%'}
            </Badge>
          )}
          {submission.status === 'rated' && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 gap-1">
              <CheckCircle className="h-3 w-3" />
              Rated
            </Badge>
          )}
          {submission.status === 'edited' && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 gap-1">
              <Pencil className="h-3 w-3" />
              Edited
            </Badge>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Designer's Comment */}
      {submission.comment && (
        <div className="flex gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <MessageSquare className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Designer&apos;s Note</p>
            <p className="text-gray-700 whitespace-pre-wrap">{submission.comment}</p>
          </div>
        </div>
      )}

      {/* Gallery + Rating Form */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Submission Assets ({submission.assets.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SubmissionGallery assets={submission.assets} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <RatingForm
            submissionId={submission.id}
            initialRating={submission.myRating}
            suggestedProductivity={submission.suggestedProductivity}
            onRated={handleRated}
          />

          <AIContextPanel designerUserId={submission.user_id} />

          {/* Reviewer Info */}
          {submission.allRatings && submission.allRatings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reviews</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {submission.allRatings.map((rating, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-sm">{rating.ratedBy}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500" />
                        Productivity: {rating.productivity}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500" />
                        Quality: {rating.quality}
                      </span>
                    </div>
                    {rating.comment && (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded p-2 mt-1">
                        {rating.comment}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {format(new Date(rating.ratedAt), 'MMM d, yyyy h:mm a')}
                    </p>
                    {index < submission.allRatings!.length - 1 && (
                      <hr className="mt-2" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Submission?</DialogTitle>
            <DialogDescription>
              This will permanently delete this submission, all its assets, and any ratings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

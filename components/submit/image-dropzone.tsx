'use client'

import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      URL.revokeObjectURL(video.src)
      resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(video.src)
      reject(new Error('Failed to load video metadata'))
    }
    video.src = URL.createObjectURL(file)
  })
}

export interface UploadedFileInfo {
  path: string
  duration?: number
}

interface ImageDropzoneProps {
  userId: string
  onUploadComplete: (files: UploadedFileInfo[]) => void
  disabled?: boolean
}

export function ImageDropzone({
  userId,
  onUploadComplete,
  disabled = false,
}: ImageDropzoneProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const supabase = createClient()

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (disabled || uploading) return

      setUploading(true)
      setProgress(0)
      const newFiles: UploadedFileInfo[] = []

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${i}.${fileExt}`
        const filePath = `${userId}/${fileName}`

        const { error } = await supabase.storage
          .from('submissions')
          .upload(filePath, file)

        if (error) {
          toast.error(`Failed to upload ${file.name}: ${error.message}`)
        } else {
          const isVideo = file.type.startsWith('video/')
          let duration: number | undefined
          if (isVideo) {
            try {
              duration = await getVideoDuration(file)
            } catch {
              // Duration extraction failed — will default later
            }
          }
          newFiles.push({ path: filePath, duration })
        }

        setProgress(Math.round(((i + 1) / acceptedFiles.length) * 100))
      }

      setUploading(false)
      setProgress(0)
      if (newFiles.length > 0) {
        onUploadComplete(newFiles)
      }
    },
    [userId, supabase, disabled, uploading, onUploadComplete]
  )

  const onDropRejected = useCallback((rejections: FileRejection[]) => {
    rejections.forEach(({ file, errors }) => {
      const isTooLarge = errors.some((e) => e.code === 'file-too-large')
      if (isTooLarge) {
        toast.error(`${file.name} exceeds the 50MB limit. Please create a lower quality version for upload.`)
        return
      }
      const reasons = errors.map((e) => {
        if (e.code === 'file-invalid-type') return 'Unsupported file type'
        return e.message
      }).join(', ')
      toast.error(`${file.name}: ${reasons}`)
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB limit (Supabase free tier)
    disabled: disabled || uploading,
  })

  return (
    <div className="space-y-6">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400',
          (disabled || uploading) && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 text-gray-400 animate-spin" />
            <p className="text-sm text-gray-600">Uploading... {progress}%</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10 text-gray-400" />
            <p className="text-sm text-gray-600">
              {isDragActive
                ? 'Drop the files here...'
                : 'Drag & drop images or videos here, or click to select'}
            </p>
            <p className="text-xs text-gray-400">
              Supports: JPEG, PNG, GIF, WebP, MP4, WebM, MOV
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useRef } from 'react'
import { Check, Upload, Link, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { fileToBase64 } from '@/lib/image-resize'
import type { SelectedImage, ImageLabel } from '@/lib/types/adgen'

interface ProductImageData {
  src: string
  width: number
  height: number
  alt: string | null
}

interface ImageSelectorProps {
  productImages: ProductImageData[]
  productTitle: string | null
  selectedImages: SelectedImage[]
  onSelectedImages: (images: SelectedImage[]) => void
}

const LABELS: { value: ImageLabel; label: string }[] = [
  { value: 'product-reference', label: 'Product' },
  { value: 'inspiration', label: 'Inspiration' },
]

let nextId = 1
function genId() {
  return `img-${nextId++}-${Date.now()}`
}

export function ImageSelector({
  productImages,
  productTitle,
  selectedImages,
  onSelectedImages,
}: ImageSelectorProps) {
  const [urlInput, setUrlInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const selectedSrcs = new Set(selectedImages.map((img) => img.src))

  const toggleProductImage = (img: ProductImageData) => {
    if (selectedSrcs.has(img.src)) {
      onSelectedImages(selectedImages.filter((s) => s.src !== img.src))
    } else {
      onSelectedImages([
        ...selectedImages,
        {
          id: genId(),
          src: img.src,
          mimeType: 'image/jpeg',
          label: 'product-reference',
          source: 'product',
        },
      ])
    }
  }

  const addFromUrl = () => {
    const trimmed = urlInput.trim()
    if (!trimmed) return
    try {
      new URL(trimmed)
    } catch {
      toast.error('Invalid URL')
      return
    }
    if (selectedSrcs.has(trimmed)) {
      toast.error('Image already added')
      return
    }
    onSelectedImages([
      ...selectedImages,
      {
        id: genId(),
        src: trimmed,
        mimeType: 'image/jpeg',
        label: 'inspiration',
        source: 'url',
      },
    ])
    setUrlInput('')
    setShowUrlInput(false)
  }

  const handleFileUpload = async (file: File) => {
    try {
      const base64 = await fileToBase64(file)
      const previewUrl = URL.createObjectURL(file)
      onSelectedImages([
        ...selectedImages,
        {
          id: genId(),
          src: previewUrl,
          base64,
          mimeType: file.type || 'image/jpeg',
          label: 'inspiration',
          source: 'upload',
        },
      ])
    } catch {
      toast.error('Failed to process image')
    }
  }

  const removeImage = (id: string) => {
    const img = selectedImages.find((s) => s.id === id)
    if (img?.source === 'upload') URL.revokeObjectURL(img.src)
    onSelectedImages(selectedImages.filter((s) => s.id !== id))
  }

  const updateLabel = (id: string, label: ImageLabel) => {
    onSelectedImages(
      selectedImages.map((s) => (s.id === id ? { ...s, label } : s))
    )
  }

  const hasProductRef = selectedImages.some(
    (s) => s.label === 'product-reference'
  )

  return (
    <div className="space-y-4">
      {/* Product images grid */}
      {productImages.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {productTitle ? `${productTitle} — ` : ''}
            {productImages.length} image
            {productImages.length !== 1 ? 's' : ''} found
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {productImages.map((img) => {
              const isSelected = selectedSrcs.has(img.src)
              return (
                <button
                  key={img.src}
                  type="button"
                  onClick={() => toggleProductImage(img)}
                  className={cn(
                    'relative aspect-square overflow-hidden rounded-lg border-2 transition-colors',
                    isSelected
                      ? 'border-primary'
                      : 'border-transparent hover:border-border'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.alt || 'Product image'}
                    className="h-full w-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                      <div className="rounded-full bg-primary p-1">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected images with labels */}
      {selectedImages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Selected ({selectedImages.length})
          </p>
          <div className="space-y-2">
            {selectedImages.map((img) => (
              <div
                key={img.id}
                className="flex items-center gap-3 rounded-lg border p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                />
                <div className="flex flex-1 gap-1">
                  {LABELS.map((l) => (
                    <Badge
                      key={l.value}
                      variant={img.label === l.value ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => updateLabel(img.id, l.value)}
                    >
                      {l.label}
                    </Badge>
                  ))}
                </div>
                <button
                  onClick={() => removeImage(img.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          {!hasProductRef && (
            <p className="text-xs text-amber-600">
              At least one image should be labeled &quot;Product&quot;
            </p>
          )}
        </div>
      )}

      {/* Add image actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUrlInput(!showUrlInput)}
        >
          <Link className="h-3.5 w-3.5 mr-1.5" />
          Add URL
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Upload
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileUpload(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* URL input */}
      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            placeholder="https://example.com/image.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addFromUrl()
            }}
            className="text-sm"
            autoFocus
          />
          <Button size="sm" onClick={addFromUrl} disabled={!urlInput.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  )
}

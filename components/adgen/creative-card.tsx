'use client'

import { useState } from 'react'
import {
  Download,
  BookmarkPlus,
  Copy,
  Pencil,
  ArrowRightLeft,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { GeneratedCreative } from '@/lib/types/adgen'

interface CreativeCardProps {
  creative: GeneratedCreative
  index: number
  onVariation: (
    creative: GeneratedCreative,
    count: number
  ) => Promise<void>
  onEdit: (
    creative: GeneratedCreative,
    instruction: string
  ) => Promise<void>
  onChangeFormat: (creative: GeneratedCreative) => Promise<void>
  onSaveToLibrary: (creative: GeneratedCreative) => Promise<void>
}

export function CreativeCard({
  creative,
  index,
  onVariation,
  onEdit,
  onChangeFormat,
  onSaveToLibrary,
}: CreativeCardProps) {
  const [editInput, setEditInput] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = `data:${creative.mimeType};base64,${creative.imageBase64}`
    link.download = `adgen-${creative.idea.title.slice(0, 30).replace(/\s+/g, '-').toLowerCase()}-${index + 1}.png`
    link.click()
  }

  const handleSave = async () => {
    setLoading('save')
    try {
      await onSaveToLibrary(creative)
    } finally {
      setLoading(null)
    }
  }

  const handleVariation = async (count: number) => {
    setLoading('vary')
    try {
      await onVariation(creative, count)
    } finally {
      setLoading(null)
    }
  }

  const handleEdit = async () => {
    if (!editInput.trim()) return
    setLoading('edit')
    try {
      await onEdit(creative, editInput.trim())
      setEditInput('')
      setShowEdit(false)
    } finally {
      setLoading(null)
    }
  }

  const handleFormat = async () => {
    setLoading('format')
    try {
      await onChangeFormat(creative)
    } finally {
      setLoading(null)
    }
  }

  const isLoading = loading !== null

  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      {/* Image */}
      <div className="aspect-square max-h-[400px] bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:${creative.mimeType};base64,${creative.imageBase64}`}
          alt={`Ad creative: ${creative.idea.title}`}
          className="h-full w-full object-contain"
        />
      </div>

      {/* Info + actions */}
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {creative.idea.title}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">
                {creative.format}
              </Badge>
              {creative.parentId && (
                <Badge variant="outline" className="text-xs">
                  Derived
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={isLoading}
            >
              {loading === 'save' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleVariation(1)}
            disabled={isLoading}
          >
            {loading === 'vary' ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            Variation
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowEdit(!showEdit)}
            disabled={isLoading}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFormat}
            disabled={isLoading}
          >
            {loading === 'format' ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
            )}
            {creative.format === '1:1' ? '→ 9:16' : '→ 1:1'}
          </Button>
        </div>

        {/* Edit input */}
        {showEdit && (
          <div className="flex gap-2">
            <Input
              placeholder="Describe the edit..."
              value={editInput}
              onChange={(e) => setEditInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEdit()
              }}
              className="text-sm"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleEdit}
              disabled={!editInput.trim() || isLoading}
            >
              {loading === 'edit' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Apply'
              )}
            </Button>
          </div>
        )}

        {/* Collapsible prompt */}
        <details className="text-xs text-gray-400">
          <summary className="flex cursor-pointer items-center gap-1 hover:text-gray-600">
            <ChevronDown className="h-3 w-3" />
            Image prompt
          </summary>
          <p className="mt-1 leading-relaxed">{creative.imagePrompt}</p>
        </details>
      </div>
    </div>
  )
}

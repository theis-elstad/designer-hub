'use client'

import { Button } from '@/components/ui/button'
import { RotateCcw, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { CreativeCard } from './creative-card'
import type { GeneratedCreative } from '@/lib/types/adgen'

interface ResultsPanelProps {
  creatives: GeneratedCreative[]
  generating?: boolean
  progress?: string
  onVariation: (creative: GeneratedCreative, count: number) => Promise<void>
  onEdit: (creative: GeneratedCreative, instruction: string) => Promise<void>
  onChangeFormat: (creative: GeneratedCreative) => Promise<void>
  onSaveToLibrary: (creative: GeneratedCreative) => Promise<void>
  onGenerateMore: () => void
  onReset: () => void
}

function PlaceholderCard({ creative }: { creative: GeneratedCreative }) {
  const failed = creative._failed
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="aspect-square bg-gray-50 flex flex-col items-center justify-center gap-3">
        {failed ? (
          <>
            <AlertCircle className="h-8 w-8 text-destructive/60" />
            <p className="text-sm text-destructive/60">Generation failed</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground/60">Generating...</p>
          </>
        )}
      </div>
      <div className="p-4">
        <p className="text-sm font-medium text-gray-900">{creative.idea.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{creative.idea.messagingAngle}</p>
      </div>
    </div>
  )
}

export function ResultsPanel({
  creatives,
  generating,
  progress,
  onVariation,
  onEdit,
  onChangeFormat,
  onSaveToLibrary,
  onGenerateMore,
  onReset,
}: ResultsPanelProps) {
  const readyCount = creatives.filter((c) => !c._generating && !c._failed).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Results</h2>
          <p className="text-sm text-muted-foreground">
            {generating
              ? progress || 'Generating...'
              : `${readyCount} creative${readyCount !== 1 ? 's' : ''} generated`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onGenerateMore} disabled={generating}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate More
          </Button>
          <Button variant="outline" size="sm" onClick={onReset} disabled={generating}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {creatives.map((creative, idx) =>
          creative._generating || creative._failed ? (
            <PlaceholderCard key={creative.id} creative={creative} />
          ) : creative.imageBase64 ? (
            <CreativeCard
              key={creative.id}
              creative={creative}
              index={idx}
              onVariation={onVariation}
              onEdit={onEdit}
              onChangeFormat={onChangeFormat}
              onSaveToLibrary={onSaveToLibrary}
            />
          ) : null
        )}
      </div>
    </div>
  )
}

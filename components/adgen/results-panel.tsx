'use client'

import { Button } from '@/components/ui/button'
import { RotateCcw, Sparkles } from 'lucide-react'
import { CreativeCard } from './creative-card'
import type { GeneratedCreative } from '@/lib/types/adgen'

interface ResultsPanelProps {
  creatives: GeneratedCreative[]
  onVariation: (creative: GeneratedCreative, count: number) => Promise<void>
  onEdit: (creative: GeneratedCreative, instruction: string) => Promise<void>
  onChangeFormat: (creative: GeneratedCreative) => Promise<void>
  onSaveToLibrary: (creative: GeneratedCreative) => Promise<void>
  onGenerateMore: () => void
  onReset: () => void
}

export function ResultsPanel({
  creatives,
  onVariation,
  onEdit,
  onChangeFormat,
  onSaveToLibrary,
  onGenerateMore,
  onReset,
}: ResultsPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Results</h2>
          <p className="text-sm text-muted-foreground">
            {creatives.length} creative{creatives.length !== 1 ? 's' : ''}{' '}
            generated
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onGenerateMore}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate More
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        {creatives.map((creative, idx) => (
          <CreativeCard
            key={creative.id}
            creative={creative}
            index={idx}
            onVariation={onVariation}
            onEdit={onEdit}
            onChangeFormat={onChangeFormat}
            onSaveToLibrary={onSaveToLibrary}
          />
        ))}
      </div>
    </div>
  )
}

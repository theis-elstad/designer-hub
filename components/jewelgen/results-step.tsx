'use client'

import { Button } from '@/components/ui/button'
import { GenerationCard } from './generation-card'

interface ResultOutput {
  path: string
  base64: string
  mimeType: string
}

interface ResultsStepProps {
  results: ResultOutput[]
  onEdit: (base64: string, mimeType: string, comment: string) => Promise<void>
  onStartOver: () => void
  onGenerateMore: () => void
  error?: string
}

export function ResultsStep({
  results,
  onEdit,
  onStartOver,
  onGenerateMore,
  error,
}: ResultsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Results</h2>
        <p className="text-sm text-muted-foreground">
          {error
            ? 'Generation failed — try again or adjust settings.'
            : `${results.length} image${results.length !== 1 ? 's' : ''} generated.`}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {results.length > 0 && (
        <div
          className={
            results.length === 1
              ? 'mx-auto max-w-sm'
              : 'grid grid-cols-1 sm:grid-cols-2 gap-6'
          }
        >
          {results.map((r, i) => (
            <GenerationCard
              key={r.path}
              base64={r.base64}
              mimeType={r.mimeType}
              path={r.path}
              index={i}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={onStartOver}>
          Start Over
        </Button>
        <Button onClick={onGenerateMore}>
          Generate More
        </Button>
      </div>
    </div>
  )
}

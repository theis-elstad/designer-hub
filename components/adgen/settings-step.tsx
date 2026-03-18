'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImageSelector } from './image-selector'
import type {
  SelectedImage,
  GenerationSettings,
  AdFormat,
  BrandResearch,
  ProductResearch,
} from '@/lib/types/adgen'

interface ProductImageData {
  src: string
  width: number
  height: number
  alt: string | null
}

interface SettingsStepProps {
  brandResearch: BrandResearch | null
  productResearch: ProductResearch | null
  productImages: ProductImageData[]
  productTitle: string | null
  selectedImages: SelectedImage[]
  onSelectedImages: (images: SelectedImage[]) => void
  settings: GenerationSettings
  onSettings: (settings: GenerationSettings) => void
  onGenerate: () => void
  onBack: () => void
}

function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="inline-flex rounded-lg border p-0.5">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              value === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsStep({
  brandResearch,
  productResearch,
  productImages,
  productTitle,
  selectedImages,
  onSelectedImages,
  settings,
  onSettings,
  onGenerate,
  onBack,
}: SettingsStepProps) {
  const hasProductRef = selectedImages.some(
    (s) => s.label === 'product-reference'
  )
  const canGenerate = selectedImages.length > 0 && hasProductRef

  return (
    <div className="space-y-6">
      {/* Research summary */}
      {(brandResearch || productResearch) && (
        <details className="group rounded-lg border">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
            <span>
              {brandResearch?.brandName || 'Brand'}
              {productResearch ? ` — ${productResearch.productName}` : ''}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t px-4 py-3 text-xs text-muted-foreground space-y-1">
            {brandResearch && (
              <p>
                <strong>Brand:</strong> {brandResearch.industry} ·{' '}
                {brandResearch.targetAudience} · {brandResearch.pricePoint}
              </p>
            )}
            {productResearch && (
              <p>
                <strong>Product:</strong> {productResearch.productType} ·{' '}
                {productResearch.price} · {productResearch.targetCustomer}
              </p>
            )}
          </div>
        </details>
      )}

      {/* Image selection */}
      <div>
        <h2 className="text-lg font-semibold">Reference Images</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Select product photos and inspiration images for the AI.
        </p>
        <ImageSelector
          productImages={productImages}
          productTitle={productTitle}
          selectedImages={selectedImages}
          onSelectedImages={onSelectedImages}
        />
      </div>

      {/* Generation settings */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Generation Settings</h3>
        <div className="flex flex-wrap gap-6">
          <SegmentedControl
            label="Ideas"
            options={[
              { value: 1, label: '1' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
            value={settings.ideaCount}
            onChange={(v) => onSettings({ ...settings, ideaCount: v })}
          />
          <SegmentedControl
            label="Variations per idea"
            options={[
              { value: 1, label: '1' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
            ]}
            value={settings.variationsPerIdea}
            onChange={(v) => onSettings({ ...settings, variationsPerIdea: v })}
          />
          <SegmentedControl<AdFormat>
            label="Format"
            options={[
              { value: '1:1', label: '1:1' },
              { value: '9:16', label: '9:16' },
            ]}
            value={settings.format}
            onChange={(v) => onSettings({ ...settings, format: v })}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onGenerate} disabled={!canGenerate} className="flex-1">
          Generate{' '}
          {settings.ideaCount * settings.variationsPerIdea > 1
            ? `${settings.ideaCount * settings.variationsPerIdea} Creatives`
            : 'Creative'}
        </Button>
      </div>
    </div>
  )
}

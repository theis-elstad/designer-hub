'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImageSelector } from './image-selector'
import { ResearchCard } from '@/components/shared/research-card'
import { SegmentedControl } from '@/components/shared/segmented-control'
import type {
  SelectedImage,
  GenerationSettings,
  AdFormat,
  BrandResearch,
  ProductResearch,
  UrlType,
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
  onBrandResearchChange?: (research: BrandResearch) => void
  onProductResearchChange?: (research: ProductResearch) => void
  onRemoveProductImage?: (src: string) => void
  urlType?: UrlType
  researchLoading?: boolean
  hasResults?: boolean
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
  onBrandResearchChange,
  onProductResearchChange,
  onRemoveProductImage,
  urlType = 'product',
  researchLoading = false,
  hasResults = false,
}: SettingsStepProps) {
  const [imagesExpanded, setImagesExpanded] = useState(!hasResults)

  // Collapse images when results appear
  useEffect(() => {
    if (hasResults) setImagesExpanded(false)
  }, [hasResults])
  const isBrandOnly = urlType === 'brand'
  const hasProductRef = selectedImages.some(
    (s) => s.label === 'product-reference'
  )
  // Brand-only URLs don't require product reference images
  const imagesReady = isBrandOnly || (selectedImages.length > 0 && hasProductRef)
  const canGenerate = imagesReady && !researchLoading

  return (
    <div className="space-y-6">
      {/* Research cards */}
      {(brandResearch || productResearch || researchLoading) && (
        <div className={cn('grid gap-4', (!isBrandOnly) ? 'sm:grid-cols-2' : '')}>
          {(brandResearch || researchLoading) && (
            <ResearchCard
              type="brand"
              research={brandResearch ?? { brandName: '', industry: '', targetAudience: '', valueProposition: '', brandVoice: '', keyMessages: [], competitiveAdvantages: [], productCategories: [], pricePoint: '', brandPersonality: [] }}
              onChange={onBrandResearchChange}
              loading={researchLoading && !brandResearch}
            />
          )}
          {!isBrandOnly && (productResearch || researchLoading) && (
            <ResearchCard
              type="product"
              research={productResearch ?? { productName: '', productType: '', price: '', targetCustomer: '', keyBenefits: [], painPointsSolved: [], uniqueSellingPoints: [], useCases: [], competitiveContext: '', emotionalTriggers: [] }}
              onChange={onProductResearchChange}
              label={urlType === 'collection' ? 'Collection Research' : undefined}
              loading={researchLoading && !productResearch}
            />
          )}
        </div>
      )}

      {/* Image selection */}
      <div>
        <button
          type="button"
          onClick={() => setImagesExpanded(!imagesExpanded)}
          className="flex w-full items-center justify-between"
        >
          <div>
            <h2 className="text-lg font-semibold">Reference Images</h2>
            {!imagesExpanded && selectedImages.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', imagesExpanded && 'rotate-180')} />
        </button>
        {imagesExpanded && (
          <>
            <p className="text-sm text-muted-foreground mb-4 mt-1">
              Select product photos and inspiration images for the AI.
            </p>
            <ImageSelector
              productImages={productImages}
              productTitle={productTitle}
              selectedImages={selectedImages}
              onSelectedImages={onSelectedImages}
              onRemoveProductImage={onRemoveProductImage}
            />
          </>
        )}
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

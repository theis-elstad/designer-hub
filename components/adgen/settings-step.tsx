'use client'

import { useState, useEffect } from 'react'
import { Pencil, Check, X, Building2, Package, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ImageSelector } from './image-selector'
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

// ─── Editable research card ──────────────────────────────────────────────

interface BrandCardProps {
  type: 'brand'
  research: BrandResearch
  onChange?: (research: BrandResearch) => void
  label?: string
  loading?: boolean
}

interface ProductCardProps {
  type: 'product'
  research: ProductResearch
  onChange?: (research: ProductResearch) => void
  label?: string
  loading?: boolean
}

type ResearchCardProps = BrandCardProps | ProductCardProps

const BRAND_FIELDS: { key: keyof BrandResearch; label: string; multiline?: boolean }[] = [
  { key: 'brandName', label: 'Name' },
  { key: 'industry', label: 'Industry' },
  { key: 'targetAudience', label: 'Target audience' },
  { key: 'valueProposition', label: 'Value prop', multiline: true },
  { key: 'brandVoice', label: 'Voice' },
  { key: 'pricePoint', label: 'Price point' },
  { key: 'keyMessages', label: 'Key messages' },
  { key: 'competitiveAdvantages', label: 'Advantages' },
  { key: 'brandPersonality', label: 'Personality' },
]

const PRODUCT_FIELDS: { key: keyof ProductResearch; label: string; multiline?: boolean }[] = [
  { key: 'productName', label: 'Name' },
  { key: 'productType', label: 'Type' },
  { key: 'price', label: 'Price' },
  { key: 'targetCustomer', label: 'Target customer' },
  { key: 'keyBenefits', label: 'Benefits' },
  { key: 'uniqueSellingPoints', label: 'USPs' },
  { key: 'painPointsSolved', label: 'Pain points solved' },
  { key: 'emotionalTriggers', label: 'Emotional triggers' },
  { key: 'competitiveContext', label: 'Competitive context', multiline: true },
]

function ResearchCard(props: ResearchCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const isBrand = props.type === 'brand'
  const isLoading = props.loading ?? false
  const research = props.research as unknown as Record<string, unknown>
  const fields = isBrand ? BRAND_FIELDS : PRODUCT_FIELDS

  // Get a summary line from the research for the collapsed view
  const summary = isBrand
    ? [research.industry, research.targetAudience, research.pricePoint].filter(Boolean).join(' · ')
    : [research.productType, research.price, research.targetCustomer].filter(Boolean).join(' · ')

  const startEdit = () => {
    setDraft({ ...research })
    setEditing(true)
    setExpanded(true)
  }

  const cancelEdit = () => {
    setDraft({})
    setEditing(false)
  }

  const saveEdit = () => {
    if (isBrand && (props as BrandCardProps).onChange) {
      ;(props as BrandCardProps).onChange!(draft as unknown as BrandResearch)
    } else if (!isBrand && (props as ProductCardProps).onChange) {
      ;(props as ProductCardProps).onChange!(draft as unknown as ProductResearch)
    }
    setEditing(false)
  }

  const updateField = (key: string, value: string) => {
    const original = research[key]
    if (Array.isArray(original)) {
      setDraft({ ...draft, [key]: value.split(',').map((s: string) => s.trim()).filter(Boolean) })
    } else {
      setDraft({ ...draft, [key]: value })
    }
  }

  const displayValue = (val: unknown): string => {
    if (Array.isArray(val)) return val.join(', ')
    return String(val ?? '')
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => !editing && setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 bg-muted/40 border-b hover:bg-muted/60 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          )}
          {props.label || (isBrand ? 'Brand Research' : 'Product Research')}
        </div>
        <div className="flex items-center gap-1">
          {!expanded && !editing && (
            <span className="text-[10px] text-muted-foreground/70 max-w-[140px] truncate hidden sm:inline">
              {isLoading ? 'Loading...' : summary}
            </span>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </div>
      </button>

      {expanded && (
        <>
          {/* Edit controls */}
          <div className="flex justify-end px-3 pt-1.5">
            {editing ? (
              <div className="flex gap-1">
                <button onClick={cancelEdit} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
                  <X className="h-3.5 w-3.5" />
                </button>
                <button onClick={saveEdit} className="rounded p-1 text-primary hover:bg-primary/10">
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={startEdit} className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="px-3 pb-2 space-y-1.5 max-h-[280px] overflow-y-auto">
            {fields.map((f) => {
              const val = editing ? draft[f.key as string] : research[f.key as string]
              return (
                <div key={f.key as string} className="text-xs">
                  <span className="font-medium text-muted-foreground">{f.label}: </span>
                  {editing ? (
                    f.multiline ? (
                      <Textarea
                        value={displayValue(val)}
                        onChange={(e) => updateField(f.key as string, e.target.value)}
                        className="mt-0.5 text-xs min-h-[48px] resize-none"
                        rows={2}
                      />
                    ) : (
                      <Input
                        value={displayValue(val)}
                        onChange={(e) => updateField(f.key as string, e.target.value)}
                        className="mt-0.5 h-7 text-xs"
                      />
                    )
                  ) : (
                    <span className="text-foreground">{displayValue(val)}</span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Settings step ──────────────────────────────────────────────────────

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

  const researchLabel = urlType === 'collection' ? 'collection' : 'product'

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

'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Sparkles, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UrlStep } from '@/components/adgen/url-step'
import { SettingsStep } from '@/components/adgen/settings-step'
import { ResultsPanel } from '@/components/adgen/results-panel'
import { ResetDialog } from '@/components/adgen/reset-dialog'
import type {
  AdGenStep,
  BrandResearch,
  ProductResearch,
  AdIdea,
  SelectedImage,
  GenerationSettings,
  GeneratedCreative,
  UrlType,
} from '@/lib/types/adgen'
import { DEFAULT_SETTINGS, detectUrlType } from '@/lib/types/adgen'

interface ProductImageData {
  src: string
  width: number
  height: number
  alt: string | null
}

async function safeFetch(url: string, body: unknown): Promise<Record<string, any>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data: Record<string, any>
  try {
    data = await res.json()
  } catch {
    throw new Error(`Server error (${res.status})`)
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

let creativeIdCounter = 0

export default function AdGenPage() {
  const [step, setStep] = useState<AdGenStep>('url')
  const [url, setUrl] = useState('')
  const [brandResearch, setBrandResearch] = useState<BrandResearch | null>(null)
  const [productResearch, setProductResearch] = useState<ProductResearch | null>(null)
  const [productImages, setProductImages] = useState<ProductImageData[]>([])
  const [productTitle, setProductTitle] = useState<string | null>(null)
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([])
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS)
  const [creatives, setCreatives] = useState<GeneratedCreative[]>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [urlType, setUrlType] = useState<UrlType>('product')
  const [researchLoading, setResearchLoading] = useState(false)

  // URL submit → parallel fetches → settings step
  const handleUrlSubmit = useCallback(async (submittedUrl: string) => {
    setUrl(submittedUrl)
    const detectedType = detectUrlType(submittedUrl)
    setUrlType(detectedType)
    setStep('settings')
    setProgress('Loading research and images...')
    setGenerating(true)
    setResearchLoading(true)

    try {
      // Fire all fetches in parallel, update state as each resolves
      const imagesFetch = safeFetch('/api/adgen/fetch-images', { url: submittedUrl })
        .then((res) => {
          setProductImages((res.images || []) as ProductImageData[])
          setProductTitle((res.title as string) || null)
        })

      const brandFetch = safeFetch('/api/adgen/brand-research', { brandUrl: submittedUrl })
        .then((res) => {
          setBrandResearch(res.research as BrandResearch)
          if (res.cached) toast.info('Using cached brand research')
        })

      const productFetch = detectedType !== 'brand'
        ? safeFetch('/api/adgen/product-research', { productUrl: submittedUrl })
            .then((res) => {
              setProductResearch(res.research as ProductResearch)
            })
        : Promise.resolve()

      await Promise.all([imagesFetch, brandFetch, productFetch])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load data')
      setStep('url')
    } finally {
      setGenerating(false)
      setResearchLoading(false)
      setProgress('')
    }
  }, [])

  // Generate creatives
  const handleGenerate = useCallback(async () => {
    if (!brandResearch) return

    setStep('results')
    setGenerating(true)

    try {
      // Prepare images payload for API
      const imagePayload = selectedImages.map((img) => ({
        url: img.source !== 'upload' ? img.src : undefined,
        base64: img.base64,
        mimeType: img.mimeType,
        label: img.label,
      }))

      // Step 1: Generate ad ideas
      setProgress('Generating ad ideas...')
      const ideasRes = await safeFetch('/api/adgen/ad-ideas', {
        brandResearch,
        productResearch,
      })
      const ideas = (ideasRes.ideas as AdIdea[]).slice(0, settings.ideaCount)

      if (!ideas || ideas.length === 0) {
        throw new Error('No ad ideas generated')
      }

      // Step 2: Create placeholder cards for each creative, then fill them in
      const total = ideas.length * settings.variationsPerIdea
      const placeholders: GeneratedCreative[] = []

      for (const idea of ideas) {
        for (let v = 0; v < settings.variationsPerIdea; v++) {
          const placeholder: GeneratedCreative = {
            id: `creative-${++creativeIdCounter}`,
            imageBase64: '',
            mimeType: '',
            imagePrompt: '',
            idea,
            format: settings.format,
            generatedAt: new Date().toISOString(),
            _generating: true,
          }
          placeholders.push(placeholder)
        }
      }

      // Show all placeholders at once
      setCreatives((prev) => [...placeholders, ...prev])

      // Generate all creatives in parallel
      setProgress(`Generating ${total} creative${total > 1 ? 's' : ''}...`)
      let completed = 0

      await Promise.all(
        placeholders.map(async (placeholder) => {
          try {
            const res = await safeFetch('/api/adgen/ad-creative', {
              adIdea: placeholder.idea,
              brandResearch,
              productResearch,
              images: imagePayload,
              format: settings.format,
            })

            setCreatives((prev) =>
              prev.map((c) =>
                c.id === placeholder.id
                  ? {
                      ...c,
                      imageBase64: res.imageBase64 as string,
                      mimeType: res.mimeType as string,
                      imagePrompt: res.imagePrompt as string,
                      _generating: false,
                    }
                  : c
              )
            )
          } catch (err) {
            setCreatives((prev) =>
              prev.map((c) =>
                c.id === placeholder.id
                  ? { ...c, _generating: false, _failed: true }
                  : c
              )
            )
            console.error(`Creative failed:`, err)
          } finally {
            completed++
            setProgress(`Generated ${completed}/${total} creatives...`)
          }
        })
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
      setProgress('')
    }
  }, [brandResearch, productResearch, selectedImages, settings])

  // Post-generation actions
  const handleVariation = useCallback(async (creative: GeneratedCreative, count: number) => {
    for (let i = 0; i < count; i++) {
      const res = await safeFetch('/api/adgen/vary-creative', {
        imageBase64: creative.imageBase64,
        mimeType: creative.mimeType,
        format: creative.format,
      })
      const newCreative: GeneratedCreative = {
        id: `creative-${++creativeIdCounter}`,
        imageBase64: res.imageBase64 as string,
        mimeType: res.mimeType as string,
        imagePrompt: `Variation of: ${creative.imagePrompt}`,
        idea: creative.idea,
        format: creative.format,
        generatedAt: new Date().toISOString(),
        parentId: creative.id,
      }
      setCreatives((prev) => [newCreative, ...prev])
    }
    toast.success(`${count} variation${count > 1 ? 's' : ''} created`)
  }, [])

  const handleEdit = useCallback(async (creative: GeneratedCreative, instruction: string) => {
    const res = await safeFetch('/api/adgen/edit-creative', {
      imageBase64: creative.imageBase64,
      mimeType: creative.mimeType,
      instruction,
    })
    const newCreative: GeneratedCreative = {
      id: `creative-${++creativeIdCounter}`,
      imageBase64: res.imageBase64 as string,
      mimeType: res.mimeType as string,
      imagePrompt: `Edit: ${instruction}`,
      idea: creative.idea,
      format: creative.format,
      generatedAt: new Date().toISOString(),
      parentId: creative.id,
    }
    setCreatives((prev) => [newCreative, ...prev])
    toast.success('Edit applied')
  }, [])

  const handleChangeFormat = useCallback(async (creative: GeneratedCreative) => {
    const targetFormat = creative.format === '1:1' ? '9:16' : '1:1'
    const res = await safeFetch('/api/adgen/change-format', {
      imageBase64: creative.imageBase64,
      mimeType: creative.mimeType,
      targetFormat,
    })
    const newCreative: GeneratedCreative = {
      id: `creative-${++creativeIdCounter}`,
      imageBase64: res.imageBase64 as string,
      mimeType: res.mimeType as string,
      imagePrompt: `Format change: ${creative.format} → ${targetFormat}`,
      idea: creative.idea,
      format: targetFormat,
      generatedAt: new Date().toISOString(),
      parentId: creative.id,
    }
    setCreatives((prev) => [newCreative, ...prev])
    toast.success(`Reformatted to ${targetFormat}`)
  }, [])

  const handleSaveToLibrary = useCallback(async (creative: GeneratedCreative) => {
    await safeFetch('/api/adgen/library', {
      brandUrl: url,
      productUrl: url,
      idea: creative.idea,
      imagePrompt: creative.imagePrompt,
      generatedBy: 'gemini-3-pro',
      adFormat: creative.format,
      imageBase64: creative.imageBase64,
      mimeType: creative.mimeType,
    })
    toast.success('Saved to library')
  }, [url])

  const handleRemoveProductImage = useCallback((src: string) => {
    setProductImages((prev) => prev.filter((img) => img.src !== src))
  }, [])

  const handleReset = useCallback(() => {
    setStep('url')
    setUrl('')
    setUrlType('product')
    setResearchLoading(false)
    setBrandResearch(null)
    setProductResearch(null)
    setProductImages([])
    setProductTitle(null)
    setSelectedImages([])
    setSettings(DEFAULT_SETTINGS)
    setCreatives([])
    setShowReset(false)
  }, [])

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="h-6 w-6" /> Ad Creative Generator
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste a URL. Select images. Get ad creatives.
          </p>
        </div>
        {step !== 'url' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              creatives.length > 0 ? setShowReset(true) : handleReset()
            }
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      {/* Steps */}
      {step === 'url' && <UrlStep onSubmit={handleUrlSubmit} />}

      {(step === 'settings' || step === 'results') && (
        <SettingsStep
          brandResearch={brandResearch}
          productResearch={productResearch}
          productImages={productImages}
          productTitle={productTitle}
          selectedImages={selectedImages}
          onSelectedImages={setSelectedImages}
          settings={settings}
          onSettings={setSettings}
          onGenerate={handleGenerate}
          onBack={() => setStep('url')}
          onBrandResearchChange={setBrandResearch}
          onProductResearchChange={setProductResearch}
          onRemoveProductImage={handleRemoveProductImage}
          urlType={urlType}
          researchLoading={researchLoading}
          hasResults={step === 'results'}
        />
      )}

      {step === 'results' && (
        <ResultsPanel
          creatives={creatives}
          generating={generating}
          progress={progress}
          onVariation={handleVariation}
          onEdit={handleEdit}
          onChangeFormat={handleChangeFormat}
          onSaveToLibrary={handleSaveToLibrary}
          onGenerateMore={() => setStep('settings')}
          onReset={() => setShowReset(true)}
        />
      )}

      <ResetDialog
        open={showReset}
        onOpenChange={setShowReset}
        onConfirm={handleReset}
      />
    </div>
  )
}

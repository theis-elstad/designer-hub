'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Search,
  Lightbulb,
  Type,
  Image,
  Check,
  RefreshCw,
  Download,
  BookmarkPlus,
  Copy,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// ─── Types ───────────────────────────────────────────────────────────────────

interface BrandResearch {
  brandName: string
  industry: string
  targetAudience: string
  valueProposition: string
  brandVoice: string
  keyMessages: string[]
  competitiveAdvantages: string[]
  productCategories: string[]
  pricePoint: string
  brandPersonality: string[]
}

interface ProductResearch {
  productName: string
  productType: string
  price: string
  targetCustomer: string
  keyBenefits: string[]
  painPointsSolved: string[]
  uniqueSellingPoints: string[]
  useCases: string[]
  competitiveContext: string
  emotionalTriggers: string[]
}

interface AdIdea {
  title: string
  coreDesire: string
  heuristic: string
  headline: string
  messagingAngle: string
  visualConcept: string
  adFormat: string
}

interface AdCopy {
  headlines: string[]
  primaryTexts: string[]
  descriptions: string[]
}

interface AdCreative {
  imageBase64: string
  mimeType: string
  imagePrompt: string
  generatedBy: string
  adFormat: string
  timestamp: string
  idea: AdIdea
  copy: AdCopy
}

type StageId = 'brand' | 'product' | 'ideas' | 'copy' | 'creative'

interface StageConfig {
  id: StageId
  label: string
  icon: typeof Search
  description: string
}

const STAGES: StageConfig[] = [
  { id: 'brand', label: 'Brand Research', icon: Search, description: 'Analysing brand positioning and voice' },
  { id: 'product', label: 'Product Analysis', icon: Search, description: 'Researching product features and audience' },
  { id: 'ideas', label: 'Ad Ideas', icon: Lightbulb, description: 'Generating creative concepts' },
  { id: 'copy', label: 'Ad Copy', icon: Type, description: 'Writing headlines and body copy' },
  { id: 'creative', label: 'Ad Creative', icon: Image, description: 'Generating visual assets' },
]

type StageStatus = 'idle' | 'running' | 'done' | 'error'

interface PipelineState {
  brandUrl: string
  productUrl: string
  brand: { status: StageStatus; data: BrandResearch | null; cached: boolean; error?: string }
  product: { status: StageStatus; data: ProductResearch | null; error?: string }
  ideas: { status: StageStatus; data: AdIdea[] | null; selected: Set<number>; error?: string }
  copy: { status: StageStatus; data: Array<{ idea: AdIdea; copy: AdCopy }> | null; error?: string }
  creative: { status: StageStatus; data: AdCreative[] | null; error?: string }
  expandedStage: StageId | null
  pipelineRunning: boolean
}

const initialState: PipelineState = {
  brandUrl: '',
  productUrl: '',
  brand: { status: 'idle', data: null, cached: false },
  product: { status: 'idle', data: null },
  ideas: { status: 'idle', data: null, selected: new Set() },
  copy: { status: 'idle', data: null },
  creative: { status: 'idle', data: null },
  expandedStage: null,
  pipelineRunning: false,
}

// ─── API calls ───────────────────────────────────────────────────────────────

async function safeFetch(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data: Record<string, unknown>
  try {
    data = await res.json()
  } catch {
    throw new Error(`Server error (${res.status})`)
  }
  if (!res.ok) throw new Error((data.error as string) || `Request failed (${res.status})`)
  return data
}

async function fetchBrandResearch(brandUrl: string): Promise<{ research: BrandResearch; brandName: string; cached: boolean }> {
  return safeFetch('/api/adgen/brand-research', { brandUrl }) as any
}

async function fetchProductResearch(productUrl: string): Promise<{ research: ProductResearch }> {
  return safeFetch('/api/adgen/product-research', { productUrl }) as any
}

async function fetchAdIdeas(brandResearch: BrandResearch, productResearch: ProductResearch): Promise<{ ideas: AdIdea[] }> {
  return safeFetch('/api/adgen/ad-ideas', { brandResearch, productResearch }) as any
}

async function fetchAdCopy(
  adIdea: AdIdea,
  brandResearch: BrandResearch,
  productResearch: ProductResearch
): Promise<{ copy: AdCopy }> {
  return safeFetch('/api/adgen/ad-copy', { adIdea, brandResearch, productResearch }) as any
}

async function fetchAdCreative(
  adIdea: AdIdea,
  adCopy: AdCopy,
  brandResearch: BrandResearch,
  productResearch: ProductResearch
): Promise<AdCreative> {
  const data = await safeFetch('/api/adgen/ad-creative', { adIdea, adCopy, brandResearch, productResearch })
  return { ...data, idea: adIdea, copy: adCopy } as AdCreative
}

// ─── Stage Card wrapper ─────────────────────────────────────────────────────

function StageCard({
  config,
  status,
  expanded,
  onToggle,
  stageIndex,
  currentStageIndex,
  children,
  summary,
}: {
  config: StageConfig
  status: StageStatus
  expanded: boolean
  onToggle: () => void
  stageIndex: number
  currentStageIndex: number
  children: React.ReactNode
  summary?: React.ReactNode
}) {
  const isUpcoming = stageIndex > currentStageIndex && status === 'idle'
  const Icon = config.icon

  return (
    <Card className={`transition-all duration-300 ${
      status === 'running' ? 'ring-2 ring-gray-900 ring-offset-2' :
      status === 'done' ? 'border-green-200 bg-green-50/30' :
      status === 'error' ? 'border-red-200 bg-red-50/30' :
      isUpcoming ? 'opacity-40' : ''
    }`}>
      <button
        onClick={onToggle}
        disabled={isUpcoming}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            status === 'done' ? 'bg-green-100 text-green-700' :
            status === 'running' ? 'bg-gray-900 text-white' :
            status === 'error' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-400'
          }`}>
            {status === 'done' ? <Check className="w-4 h-4" /> :
             status === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> :
             status === 'error' ? '!' :
             <Icon className="w-4 h-4" />}
          </div>
          <div>
            <span className={`font-medium text-sm ${
              status === 'done' ? 'text-green-800' :
              status === 'running' ? 'text-gray-900' :
              status === 'error' ? 'text-red-800' :
              'text-gray-500'
            }`}>{config.label}</span>
            {status === 'running' && (
              <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>
            )}
            {status === 'done' && !expanded && summary && (
              <div className="text-xs text-gray-500 mt-0.5">{summary}</div>
            )}
            {status === 'error' && (
              <p className="text-xs text-red-600 mt-0.5">Failed — expand to retry</p>
            )}
          </div>
        </div>
        {!isUpcoming && (
          expanded
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <CardContent className="px-5 pb-5 pt-0">
          <div className="border-t pt-4">
            {children}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

// ─── Inline helper components ─────────────────────────────────────────────

function ResearchField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-white/60 rounded-lg border border-gray-100">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  )
}

function TagsList({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className="p-3 bg-white/60 rounded-lg border border-gray-100">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-1">
        {tags?.slice(0, 6).map((tag, i) => (
          <Badge key={i} variant="secondary" className="text-xs font-normal">{tag}</Badge>
        ))}
      </div>
    </div>
  )
}

function CopyGroup({ label, items, charLimit }: { label: string; items: string[]; charLimit: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <span className="text-[10px] text-gray-300">max {charLimit}</span>
      </div>
      {items?.map((item, i) => (
        <div key={i} className="flex items-start gap-2 group">
          <span className="text-xs text-gray-300 mt-1.5 font-mono w-4 shrink-0">{i + 1}.</span>
          <div className="flex-1 relative">
            <p className={`text-sm p-2 rounded-lg bg-white/60 border border-gray-100 ${
              item.length > charLimit ? 'border-red-200' : ''
            }`}>{item}</p>
            <button
              onClick={() => { navigator.clipboard.writeText(item); toast.success('Copied') }}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100"
            >
              <Copy className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Running stage skeleton ──────────────────────────────────────────────

function StageLoadingSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidUrl(str: string): boolean {
  if (!str.trim()) return false
  try {
    new URL(str.startsWith('http') ? str : `https://${str}`)
    return true
  } catch {
    return false
  }
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AdGenPage() {
  const [state, setState] = useState<PipelineState>(initialState)
  const abortRef = useRef<AbortController | null>(null)

  // Derive current stage index (which stage is active/next)
  const currentStageIndex = (() => {
    if (state.creative.status === 'done' || state.creative.status === 'running') return 4
    if (state.copy.status === 'done' || state.copy.status === 'running') return 3
    if (state.ideas.status === 'done' || state.ideas.status === 'running') return 2
    if (state.product.status === 'done' || state.product.status === 'running') return 1
    if (state.brand.status === 'done' || state.brand.status === 'running') return 0
    return -1
  })()

  // Clear downstream stages from a given stage
  const clearDownstream = useCallback((fromStage: StageId) => {
    const stageOrder: StageId[] = ['brand', 'product', 'ideas', 'copy', 'creative']
    const startIdx = stageOrder.indexOf(fromStage)
    setState(prev => {
      const next = { ...prev }
      for (let i = startIdx + 1; i < stageOrder.length; i++) {
        const id = stageOrder[i]
        if (id === 'ideas') {
          next.ideas = { status: 'idle', data: null, selected: new Set() }
        } else if (id === 'brand') {
          next.brand = { status: 'idle', data: null, cached: false }
        } else {
          (next as any)[id] = { status: 'idle', data: null }
        }
      }
      return next
    })
  }, [])

  // Toggle stage expansion
  const toggleStage = useCallback((stageId: StageId) => {
    setState(prev => ({
      ...prev,
      expandedStage: prev.expandedStage === stageId ? null : stageId,
    }))
  }, [])

  // ─── Pipeline runner ─────────────────────────────────────────────────────

  const runPipeline = useCallback(async (brandUrl: string, productUrl?: string) => {
    const abort = new AbortController()
    abortRef.current = abort

    setState(prev => ({
      ...prev,
      brandUrl,
      productUrl: productUrl || prev.productUrl,
      pipelineRunning: true,
      expandedStage: null,
      // Reset all stages
      brand: { status: 'idle', data: null, cached: false },
      product: { status: 'idle', data: null },
      ideas: { status: 'idle', data: null, selected: new Set() },
      copy: { status: 'idle', data: null },
      creative: { status: 'idle', data: null },
    }))

    try {
      // Stage 1: Brand Research
      setState(prev => ({ ...prev, brand: { ...prev.brand, status: 'running' } }))
      const brandResult = await fetchBrandResearch(brandUrl)
      if (abort.signal.aborted) return
      setState(prev => ({
        ...prev,
        brand: { status: 'done', data: brandResult.research, cached: brandResult.cached },
      }))
      if (brandResult.cached) toast.info('Using cached brand research')

      // Stage 2: Product Research
      if (abort.signal.aborted) return
      const pUrl = productUrl || brandUrl
      setState(prev => ({ ...prev, productUrl: pUrl, product: { ...prev.product, status: 'running' } }))
      const productResult = await fetchProductResearch(pUrl)
      if (abort.signal.aborted) return
      setState(prev => ({
        ...prev,
        product: { status: 'done', data: productResult.research },
      }))

      // Stage 3: Ad Ideas
      if (abort.signal.aborted) return
      setState(prev => ({ ...prev, ideas: { ...prev.ideas, status: 'running' } }))
      const ideasResult = await fetchAdIdeas(brandResult.research, productResult.research)
      if (abort.signal.aborted) return
      const autoSelected = new Set<number>([0, 1, 2].filter(i => i < ideasResult.ideas.length))
      setState(prev => ({
        ...prev,
        ideas: { status: 'done', data: ideasResult.ideas, selected: autoSelected },
      }))

      // Stage 4: Ad Copy (for selected ideas)
      if (abort.signal.aborted) return
      setState(prev => ({ ...prev, copy: { ...prev.copy, status: 'running' } }))
      const selectedIdeas = Array.from(autoSelected).map(i => ideasResult.ideas[i])
      const copyResults = await Promise.all(
        selectedIdeas.map(async idea => {
          const result = await fetchAdCopy(idea, brandResult.research, productResult.research)
          return { idea, copy: result.copy }
        })
      )
      if (abort.signal.aborted) return
      setState(prev => ({
        ...prev,
        copy: { status: 'done', data: copyResults },
      }))

      // Stage 5: Ad Creatives
      if (abort.signal.aborted) return
      setState(prev => ({ ...prev, creative: { ...prev.creative, status: 'running' } }))
      const creatives: AdCreative[] = []
      for (const { idea, copy } of copyResults) {
        if (abort.signal.aborted) return
        const creative = await fetchAdCreative(idea, copy, brandResult.research, productResult.research)
        creatives.push(creative)
        setState(prev => ({
          ...prev,
          creative: { ...prev.creative, data: [...creatives] },
        }))
      }
      if (abort.signal.aborted) return
      setState(prev => ({
        ...prev,
        creative: { status: 'done', data: creatives },
        pipelineRunning: false,
        expandedStage: 'creative',
      }))

    } catch (err) {
      if (abort.signal.aborted) return
      const msg = err instanceof Error ? err.message : 'Pipeline failed'
      toast.error(msg)
      // Mark whichever stage was running as errored
      setState(prev => {
        const next = { ...prev, pipelineRunning: false }
        const stages: StageId[] = ['brand', 'product', 'ideas', 'copy', 'creative']
        for (const s of stages) {
          if ((next as any)[s].status === 'running') {
            (next as any)[s] = { ...(next as any)[s], status: 'error', error: msg }
            next.expandedStage = s
            break
          }
        }
        return next
      })
    }
  }, [])

  // Re-run a single stage (and clear downstream)
  const rerunStage = useCallback(async (stageId: StageId) => {
    clearDownstream(stageId)
    const { brandUrl, productUrl, brand, product, ideas } = state

    try {
      if (stageId === 'brand') {
        setState(prev => ({ ...prev, brand: { ...prev.brand, status: 'running' } }))
        const result = await fetchBrandResearch(brandUrl)
        setState(prev => ({
          ...prev,
          brand: { status: 'done', data: result.research, cached: result.cached },
        }))
      } else if (stageId === 'product' && brand.data) {
        setState(prev => ({ ...prev, product: { ...prev.product, status: 'running' } }))
        const result = await fetchProductResearch(productUrl)
        setState(prev => ({
          ...prev,
          product: { status: 'done', data: result.research },
        }))
      } else if (stageId === 'ideas' && brand.data && product.data) {
        setState(prev => ({ ...prev, ideas: { ...prev.ideas, status: 'running' } }))
        const result = await fetchAdIdeas(brand.data, product.data)
        const autoSelected = new Set<number>([0, 1, 2].filter(i => i < result.ideas.length))
        setState(prev => ({
          ...prev,
          ideas: { status: 'done', data: result.ideas, selected: autoSelected },
        }))
      } else if (stageId === 'copy' && brand.data && product.data && ideas.data) {
        setState(prev => ({ ...prev, copy: { ...prev.copy, status: 'running' } }))
        const selectedIdeas = Array.from(ideas.selected).map(i => ideas.data![i])
        const results = await Promise.all(
          selectedIdeas.map(async idea => {
            const result = await fetchAdCopy(idea, brand.data!, product.data!)
            return { idea, copy: result.copy }
          })
        )
        setState(prev => ({
          ...prev,
          copy: { status: 'done', data: results },
        }))
      } else if (stageId === 'creative' && brand.data && product.data && state.copy.data) {
        setState(prev => ({ ...prev, creative: { ...prev.creative, status: 'running' } }))
        const creatives: AdCreative[] = []
        for (const { idea, copy } of state.copy.data) {
          const creative = await fetchAdCreative(idea, copy, brand.data!, product.data!)
          creatives.push(creative)
          setState(prev => ({
            ...prev,
            creative: { ...prev.creative, data: [...creatives] },
          }))
        }
        setState(prev => ({
          ...prev,
          creative: { status: 'done', data: creatives },
        }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      toast.error(msg)
      setState(prev => ({
        ...prev,
        [stageId]: { ...(prev as any)[stageId], status: 'error', error: msg },
      }))
    }
  }, [state, clearDownstream])

  // Toggle idea selection
  const toggleIdea = useCallback((index: number) => {
    setState(prev => {
      const next = new Set(prev.ideas.selected)
      if (next.has(index)) {
        next.delete(index)
      } else if (next.size < 3) {
        next.add(index)
      } else {
        toast.info('Select up to 3 ideas')
        return prev
      }
      return { ...prev, ideas: { ...prev.ideas, selected: next } }
    })
  }, [])

  // Download image
  const downloadImage = useCallback((creative: AdCreative, index: number) => {
    const link = document.createElement('a')
    link.href = `data:${creative.mimeType};base64,${creative.imageBase64}`
    link.download = `adgen-creative-${index + 1}.png`
    link.click()
  }, [])

  // Save to library
  const saveToLibrary = useCallback(async (creative: AdCreative) => {
    try {
      const res = await fetch('/api/adgen/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandUrl: state.brandUrl,
          productUrl: state.productUrl,
          idea: creative.idea,
          copy: creative.copy,
          imagePrompt: creative.imagePrompt,
          generatedBy: creative.generatedBy,
          adFormat: creative.adFormat,
          imageBase64: creative.imageBase64,
          mimeType: creative.mimeType,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Save failed')
      }
      toast.success('Saved to library')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }, [state.brandUrl, state.productUrl])

  // ─── Input form (shown when pipeline hasn't started) ─────────────────────

  const [urls, setUrls] = useState<string[]>([''])

  const updateUrl = useCallback((index: number, value: string) => {
    setUrls(prev => {
      const next = [...prev]
      next[index] = value
      // Remove trailing empty slots that no longer follow a valid URL
      while (next.length > 1 && next[next.length - 1] === '' && !isValidUrl(next[next.length - 2]?.trim())) {
        next.pop()
      }
      // Add a new empty slot when the last one becomes valid (max 5)
      if (isValidUrl(next[next.length - 1]?.trim()) && next.length < 5) {
        next.push('')
      }
      return next
    })
  }, [])

  const validUrls = urls.filter(u => isValidUrl(u.trim())).map(u => u.trim())

  const hasStarted = currentStageIndex >= 0

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6" /> Ad Creative Generator
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Paste a URL. Get ad creatives.</p>
      </div>

      {/* Input area — always visible when pipeline hasn't started */}
      {!hasStarted && (
        <Card className="mb-6">
          <CardContent className="p-5 space-y-3">
            {urls.map((url, i) => (
              <Input
                key={i}
                placeholder={i === 0 ? 'Paste a URL...' : 'Add another URL...'}
                value={url}
                onChange={e => updateUrl(i, e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && validUrls.length > 0) {
                    runPipeline(validUrls[0], validUrls[1])
                  }
                }}
                className="text-base"
                autoFocus={i === 0}
              />
            ))}
            <Button
              onClick={() => runPipeline(validUrls[0], validUrls[1])}
              disabled={validUrls.length === 0}
              className="w-full"
              size="lg"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Ad Creatives
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pipeline stages */}
      {hasStarted && (
        <div className="space-y-3">
          {STAGES.map((config, i) => {
            const stageState = state[config.id]
            const status = (stageState as any).status as StageStatus
            const expanded = state.expandedStage === config.id

            return (
              <StageCard
                key={config.id}
                config={config}
                status={status}
                expanded={expanded}
                onToggle={() => toggleStage(config.id)}
                stageIndex={i}
                currentStageIndex={currentStageIndex}
                summary={
                  config.id === 'brand' && state.brand.data ? (
                    <span>{state.brand.data.brandName} · {state.brand.data.industry} {state.brand.cached && '(cached)'}</span>
                  ) : config.id === 'product' && state.product.data ? (
                    <span>{state.product.data.productName} · {state.product.data.price}</span>
                  ) : config.id === 'ideas' && state.ideas.data ? (
                    <span>{state.ideas.data.length} ideas · {state.ideas.selected.size} selected</span>
                  ) : config.id === 'copy' && state.copy.data ? (
                    <span>{state.copy.data.length} copy sets generated</span>
                  ) : config.id === 'creative' && state.creative.data ? (
                    <span>{state.creative.data.length} creative{state.creative.data.length !== 1 ? 's' : ''} generated</span>
                  ) : undefined
                }
              >
                {/* Stage-specific content */}
                {status === 'running' && <StageLoadingSkeleton />}

                {/* ── Brand Research ── */}
                {config.id === 'brand' && state.brand.data && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold text-gray-900">{state.brand.data.brandName}</h3>
                      {state.brand.cached && <Badge variant="secondary" className="text-xs">Cached</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ResearchField label="Industry" value={state.brand.data.industry} />
                      <ResearchField label="Price Point" value={state.brand.data.pricePoint} />
                      <ResearchField label="Target Audience" value={state.brand.data.targetAudience} />
                      <ResearchField label="Brand Voice" value={state.brand.data.brandVoice} />
                    </div>
                    <ResearchField label="Value Proposition" value={state.brand.data.valueProposition} />
                    <div className="grid grid-cols-2 gap-3">
                      <TagsList label="Brand Personality" tags={state.brand.data.brandPersonality} />
                      <TagsList label="Key Messages" tags={state.brand.data.keyMessages} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => rerunStage('brand')}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-run Brand Research
                    </Button>
                  </div>
                )}

                {/* ── Product Research ── */}
                {config.id === 'product' && state.product.data && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">{state.product.data.productName}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <ResearchField label="Product Type" value={state.product.data.productType} />
                      <ResearchField label="Price" value={state.product.data.price} />
                      <ResearchField label="Target Customer" value={state.product.data.targetCustomer} />
                      <ResearchField label="Competitive Context" value={state.product.data.competitiveContext} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <TagsList label="Key Benefits" tags={state.product.data.keyBenefits} />
                      <TagsList label="Pain Points Solved" tags={state.product.data.painPointsSolved} />
                      <TagsList label="Emotional Triggers" tags={state.product.data.emotionalTriggers} />
                      <TagsList label="USPs" tags={state.product.data.uniqueSellingPoints} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => rerunStage('product')}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Re-run Product Research
                    </Button>
                  </div>
                )}

                {/* ── Ad Ideas ── */}
                {config.id === 'ideas' && state.ideas.data && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-500">Select up to 3 ideas to generate copy and creatives for.</p>
                    <div className="grid gap-2">
                      {state.ideas.data.map((idea, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleIdea(idx)}
                          className={`text-left p-3 rounded-lg border-2 transition-all ${
                            state.ideas.selected.has(idx)
                              ? 'border-gray-900 bg-gray-50'
                              : 'border-gray-100 hover:border-gray-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                <span className="font-medium text-gray-900 text-sm">{idea.title}</span>
                                <Badge variant="outline" className="text-[10px]">{idea.adFormat}</Badge>
                                <Badge variant="secondary" className="text-[10px]">{idea.coreDesire}</Badge>
                              </div>
                              <p className="text-sm text-gray-700 font-medium">"{idea.headline}"</p>
                              <p className="text-xs text-gray-500 mt-0.5">{idea.messagingAngle}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center mt-0.5 ${
                              state.ideas.selected.has(idx) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                            }`}>
                              {state.ideas.selected.has(idx) && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => rerunStage('ideas')}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate Ideas
                    </Button>
                  </div>
                )}

                {/* ── Ad Copy ── */}
                {config.id === 'copy' && state.copy.data && (
                  <div className="space-y-5">
                    {state.copy.data.map((result, idx) => (
                      <div key={idx} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900">{result.idea.title}</span>
                          <Badge variant="outline" className="text-[10px]">{result.idea.adFormat}</Badge>
                        </div>
                        <div className="p-2.5 bg-gray-50 rounded-lg">
                          <p className="text-xs text-gray-500">{result.idea.messagingAngle}</p>
                        </div>
                        <CopyGroup label="Headlines" items={result.copy.headlines} charLimit={30} />
                        <CopyGroup label="Primary Texts" items={result.copy.primaryTexts} charLimit={125} />
                        <CopyGroup label="Descriptions" items={result.copy.descriptions} charLimit={30} />
                        {idx < state.copy.data!.length - 1 && <hr className="border-gray-100" />}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => rerunStage('copy')}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate Copy
                    </Button>
                  </div>
                )}

                {/* ── Ad Creatives ── */}
                {config.id === 'creative' && state.creative.data && (
                  <div className="space-y-5">
                    {state.creative.data.map((creative, idx) => (
                      <div key={idx} className="border rounded-xl overflow-hidden bg-white">
                        <div className="aspect-square bg-gray-50 relative max-h-[400px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`data:${creative.mimeType};base64,${creative.imageBase64}`}
                            alt={`Ad creative: ${creative.idea.title}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{creative.idea.title}</p>
                              <p className="text-xs text-gray-400">{creative.generatedBy} · {creative.adFormat}</p>
                            </div>
                            <div className="flex gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => downloadImage(creative, idx)}>
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => saveToLibrary(creative)}>
                                <BookmarkPlus className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Headlines</p>
                            {creative.copy.headlines.map((h, j) => (
                              <p key={j} className="text-sm text-gray-800">"{h}"</p>
                            ))}
                          </div>
                          <details className="text-xs text-gray-400">
                            <summary className="cursor-pointer hover:text-gray-600">Image prompt</summary>
                            <p className="mt-1 leading-relaxed">{creative.imagePrompt}</p>
                          </details>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => rerunStage('creative')}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerate All Creatives
                      </Button>
                    </div>
                  </div>
                )}

                {/* Error state with retry */}
                {status === 'error' && (
                  <div className="space-y-3">
                    <p className="text-sm text-red-600">{(stageState as any).error || 'Something went wrong'}</p>
                    <Button variant="outline" size="sm" onClick={() => rerunStage(config.id)}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                    </Button>
                  </div>
                )}
              </StageCard>
            )
          })}
        </div>
      )}

      {/* Restart button after pipeline completes */}
      {hasStarted && !state.pipelineRunning && state.creative.status === 'done' && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => {
              setState(initialState)
              setUrls([''])
            }}
          >
            <Sparkles className="w-4 h-4 mr-2" /> Start New Generation
          </Button>
        </div>
      )}
    </div>
  )
}

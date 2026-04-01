'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Wand2, ChevronDown, Loader2, X, Pencil, Globe, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { GuidelinesEditor } from '@/components/creative-strategist/guidelines-editor'
import { AvatarSelect } from '@/components/creative-strategist/avatar-select'
import { ResearchCard } from '@/components/shared/research-card'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { ImageSelector } from '@/components/adgen/image-selector'
import { ResultsPanel } from '@/components/adgen/results-panel'
import { PromptSettingsModal } from '@/components/creative-strategist/prompt-settings-modal'
import type { BrandResearch, ProductResearch, SelectedImage, GeneratedCreative, AdIdea } from '@/lib/types/adgen'
import type { CSBrand, CSProduct, CSAvatar, AvatarResearch, AvatarSuggestion } from '@/lib/types/creative-strategist'

interface ProductImageData {
  src: string
  width: number
  height: number
  alt: string | null
}

async function safeFetch(url: string, body?: unknown, method = 'POST'): Promise<Record<string, any>> {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  let data: Record<string, any>
  try { data = await res.json() } catch { throw new Error(`Server error (${res.status})`) }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

async function safeGet(url: string): Promise<Record<string, any>> {
  const res = await fetch(url)
  let data: Record<string, any>
  try { data = await res.json() } catch { throw new Error(`Server error (${res.status})`) }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

let creativeIdCounter = 0

// ─── Inline search input with dropdown ────────────────────────────────────

function isUrl(s: string): boolean {
  const trimmed = s.trim()
  return /^https?:\/\//.test(trimmed) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(trimmed) || trimmed.includes('/products/') || trimmed.includes('/collections/')
}

function InlineSearch<T>({
  placeholder,
  onSearch,
  onSelect,
  onCreate,
  onUrlSubmit,
  renderItem,
  createLabel = (q) => `Create "${q}"`,
  urlLabel = (q) => `Research "${q}"`,
  loading = false,
  detectUrl = false,
}: {
  placeholder: string
  onSearch: (query: string) => Promise<T[]>
  onSelect: (item: T) => void
  onCreate: (query: string) => void
  onUrlSubmit?: (url: string) => void
  renderItem: (item: T) => { label: string; sublabel?: string }
  createLabel?: (query: string) => string
  urlLabel?: (query: string) => string
  loading?: boolean
  detectUrl?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (value: string) => {
    setQuery(value)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try { setResults(await onSearch(value)) } catch { setResults([]) }
      finally { setSearching(false) }
    }, 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault()
      if (detectUrl && isUrl(query.trim()) && onUrlSubmit) {
        onUrlSubmit(query.trim())
        setQuery('')
        setOpen(false)
      } else if (results.length > 0) {
        onSelect(results[0])
        setQuery('')
        setOpen(false)
      }
    }
  }

  const inputIsUrl = detectUrl && isUrl(query.trim())

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { setOpen(true); handleChange(query) }}
        onKeyDown={handleKeyDown}
        className="text-sm h-9"
        disabled={loading}
      />
      {(searching || loading) && (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && (query.trim() || results.length > 0) && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-[240px] overflow-y-auto">
          {results.map((item, i) => {
            const { label, sublabel } = renderItem(item)
            return (
              <button
                key={i}
                type="button"
                onClick={() => { onSelect(item); setQuery(''); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{label}</p>
                  {sublabel && <p className="text-xs text-muted-foreground truncate">{sublabel}</p>}
                </div>
              </button>
            )
          })}
          {query.trim() && (
            <>
              {inputIsUrl && onUrlSubmit ? (
                <button
                  type="button"
                  onClick={() => { onUrlSubmit(query.trim()); setQuery(''); setOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors border-t"
                >
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <span className="text-primary font-medium">{urlLabel(query.trim())}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { onCreate(query.trim()); setQuery(''); setOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors border-t"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span className="text-primary font-medium">{createLabel(query.trim())}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Row component ────────────────────────────────────────────────────────
// Label on left, content on right. Edit panel expands below.

function Row({
  label,
  children,
  editPanel,
  selected,
  selectedLabel,
  selectedSublabel,
  onClear,
  onEdit,
  editing,
  loading,
}: {
  label: string
  children?: React.ReactNode // shown when no selection
  editPanel?: React.ReactNode // shown when editing
  selected: boolean
  selectedLabel?: string
  selectedSublabel?: string
  onClear?: () => void
  onEdit?: () => void
  editing?: boolean
  loading?: boolean
}) {
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-3 min-h-[44px]">
        <span className="text-sm font-semibold text-muted-foreground w-[100px] shrink-0">{label}</span>
        <div className="flex-1 min-w-0">
          {selected ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5 min-w-0">
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
                ) : null}
                <span className="text-sm font-medium truncate">{selectedLabel}</span>
                {selectedSublabel && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">{selectedSublabel}</span>
                )}
              </div>
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className={cn(
                    'rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                    editing && 'text-primary bg-primary/10'
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
      {editing && editPanel && (
        <div className="ml-[112px] mt-1 mb-2 rounded-lg border bg-white p-4 space-y-4">
          {editPanel}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export default function CreativeStrategistPage() {
  // Brand state
  const [brand, setBrand] = useState<CSBrand | null>(null)
  const [brandResearch, setBrandResearch] = useState<BrandResearch | null>(null)
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandEditing, setBrandEditing] = useState(false)
  const [brandGuidelines, setBrandGuidelines] = useState<string[]>([])

  // New brand form
  const [newBrand, setNewBrand] = useState<{ name: string; domain: string; guidelines: string[] } | null>(null)
  const [researchLoading, setResearchLoading] = useState(false)

  // Product state
  const [product, setProduct] = useState<CSProduct | null>(null)
  const [productResearch, setProductResearch] = useState<ProductResearch | null>(null)
  const [productLoading, setProductLoading] = useState(false)
  const [productEditing, setProductEditing] = useState(false)

  // Avatar state
  const [selectedAvatars, setSelectedAvatars] = useState<CSAvatar[]>([])
  const [avatars, setAvatars] = useState<CSAvatar[]>([])
  const [avatarsLoading, setAvatarsLoading] = useState(false)
  const [avatarCreating, setAvatarCreating] = useState(false) // create flow open
  const [avatarSuggestions, setAvatarSuggestions] = useState<AvatarSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [deepResearchLoading, setDeepResearchLoading] = useState<string | null>(null) // suggestion name being researched
  const [avatarEditing, setAvatarEditing] = useState(false)

  // Generation state
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([])
  const [productImages, setProductImages] = useState<ProductImageData[]>([])
  const [productTitle, setProductTitle] = useState<string | null>(null)
  const [ideaCount, setIdeaCount] = useState(3)
  const [formats, setFormats] = useState<('1:1' | '9:16')[]>(['1:1'])
  const [additionalInstructions, setAdditionalInstructions] = useState('')
  const [creatives, setCreatives] = useState<GeneratedCreative[]>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')

  // ─── Brand handlers ───────────────────────────────────────────────────

  const searchBrands = useCallback(async (q: string) => {
    const res = await safeGet(`/api/cs/brands?q=${encodeURIComponent(q)}`)
    return res.brands as CSBrand[]
  }, [])

  const selectBrand = useCallback(async (b: CSBrand) => {
    setBrand(b)
    setNewBrand(null)
    setBrandGuidelines(Array.isArray(b.guidelines) ? b.guidelines : [])
    setBrandLoading(true)
    try {
      const res = await safeFetch('/api/adgen/brand-research', { brandUrl: b.domain })
      setBrandResearch(res.research as BrandResearch)
    } catch {
      toast.error('Failed to load brand research')
    } finally {
      setBrandLoading(false)
    }
  }, [])

  const startNewBrand = useCallback((name: string) => {
    setNewBrand({ name, domain: '', guidelines: [] })
    setBrand(null)
    setBrandResearch(null)
    setBrandGuidelines([])
  }, [])

  const saveBrand = useCallback(async () => {
    if (!newBrand || !newBrand.domain || !brandResearch) return
    setBrandLoading(true)
    try {
      const res = await safeFetch('/api/cs/brands', {
        brand_name: brandResearch.brandName || newBrand.name,
        domain: newBrand.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
        guidelines: newBrand.guidelines,
      })
      const saved = res.brand as CSBrand
      setBrand(saved)
      setBrandGuidelines(newBrand.guidelines)
      setNewBrand(null)
      toast.success('Brand saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save brand')
    } finally {
      setBrandLoading(false)
    }
  }, [newBrand, brandResearch])

  const researchBrand = useCallback(async () => {
    if (!newBrand?.domain) return
    setResearchLoading(true)
    try {
      const res = await safeFetch('/api/adgen/brand-research', { brandUrl: newBrand.domain })
      setBrandResearch(res.research as BrandResearch)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Research failed')
    } finally {
      setResearchLoading(false)
    }
  }, [newBrand?.domain])

  const updateBrand = useCallback(async () => {
    if (!brand) return
    try {
      await safeFetch('/api/cs/brands', { id: brand.id, guidelines: brandGuidelines }, 'PATCH')
      setBrand({ ...brand, guidelines: brandGuidelines })
      setBrandEditing(false)
      toast.success('Brand updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update brand')
    }
  }, [brand, brandGuidelines])

  const clearBrand = useCallback(() => {
    setBrand(null)
    setNewBrand(null)
    setBrandResearch(null)
    setBrandGuidelines([])
    setBrandEditing(false)
    setProduct(null)
    setProductResearch(null)
    setProductEditing(false)
    setSelectedAvatars([])
    setAvatars([])
    setAvatarSuggestions([])
    setAvatarEditing(false)
    setAvatarCreating(false)
    setSelectedImages([])
    setProductImages([])
    setCreatives([])
  }, [])

  // ─── Product handlers ─────────────────────────────────────────────────

  const searchProducts = useCallback(async (q: string) => {
    if (!brand) return []
    const res = await safeGet(`/api/cs/products?brandId=${brand.id}&q=${encodeURIComponent(q)}`)
    return res.products as CSProduct[]
  }, [brand])

  const selectProduct = useCallback(async (p: CSProduct) => {
    setProduct(p)
    setProductLoading(true)
    try {
      const [researchRes, imagesRes] = await Promise.all([
        safeFetch('/api/adgen/product-research', { productUrl: p.url }),
        safeFetch('/api/adgen/fetch-images', { url: p.url }),
      ])
      setProductResearch(researchRes.research as ProductResearch)
      setProductImages((imagesRes.images || []) as ProductImageData[])
      setProductTitle((imagesRes.title as string) || null)
    } catch {
      toast.error('Failed to load product data')
    } finally {
      setProductLoading(false)
    }
    loadAvatars()
  }, [brand])

  const addProductFromUrl = useCallback(async (url: string) => {
    if (!brand || !url.trim()) return
    setProductLoading(true)
    // Check if product with this URL already exists
    try {
      const existing = await safeGet(`/api/cs/products?brandId=${brand.id}&q=`)
      const products = existing.products as CSProduct[]
      const match = products.find((p) => p.url === url.trim())
      if (match) {
        await selectProduct(match)
        return
      }
    } catch { /* continue to create */ }

    try {
      const [researchRes, imagesRes] = await Promise.all([
        safeFetch('/api/adgen/product-research', { productUrl: url }),
        safeFetch('/api/adgen/fetch-images', { url }),
      ])
      setProductResearch(researchRes.research as ProductResearch)
      setProductImages((imagesRes.images || []) as ProductImageData[])
      setProductTitle((imagesRes.title as string) || null)

      const productName = (researchRes.research as ProductResearch)?.productName || url
      const productType = url.toLowerCase().includes('/collections/') ? 'collection' : 'product'

      const saveRes = await safeFetch('/api/cs/products', {
        brand_id: brand.id,
        name: productName,
        url,
        type: productType,
      })
      setProduct(saveRes.product as CSProduct)
      toast.success('Product added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add product')
    } finally {
      setProductLoading(false)
    }
    loadAvatars()
  }, [brand, selectProduct])

  const clearProduct = useCallback(() => {
    setProduct(null)
    setProductResearch(null)
    setProductEditing(false)
    setSelectedAvatars([])
    setAvatarSuggestions([])
    setAvatarEditing(false)
    setAvatarCreating(false)
    setSelectedImages([])
    setProductImages([])
    setCreatives([])
  }, [])

  // ─── Avatar handlers ──────────────────────────────────────────────────

  const loadAvatars = useCallback(async () => {
    if (!brand) return
    setAvatarsLoading(true)
    try {
      const res = await safeGet(`/api/cs/avatars?brandId=${brand.id}`)
      setAvatars(res.avatars as CSAvatar[])
    } catch { /* ignore */ }
    finally { setAvatarsLoading(false) }
  }, [brand])

  const startAvatarCreation = useCallback(async () => {
    setAvatarCreating(true)
    setAvatarSuggestions([])
    if (!brandResearch) return
    setSuggestionsLoading(true)
    try {
      const res = await safeFetch('/api/cs/avatar-suggestions', { brandResearch, productResearch })
      setAvatarSuggestions(res.suggestions as AvatarSuggestion[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate suggestions')
    } finally {
      setSuggestionsLoading(false)
    }
  }, [brandResearch, productResearch])

  const deepResearchAndSave = useCallback(async (suggestion: AvatarSuggestion) => {
    if (!brand || !brandResearch) return
    setDeepResearchLoading(suggestion.name)
    try {
      const res = await safeFetch('/api/cs/avatar-research', {
        brandResearch,
        productResearch,
        suggestion,
      })
      const research = res.research as AvatarResearch

      // Save to DB
      const saveRes = await safeFetch('/api/cs/avatars', {
        brand_id: brand.id,
        name: research.name || suggestion.name,
        research,
        products_used: product ? [product.id] : [],
      })
      const saved = saveRes.avatar as CSAvatar
      setAvatars((prev) => [saved, ...prev])
      setSelectedAvatars((prev) => [...prev, saved])
      setAvatarCreating(false)
      setAvatarSuggestions([])
      toast.success(`Avatar "${saved.name}" created & selected`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Avatar research failed')
    } finally {
      setDeepResearchLoading(null)
    }
  }, [brand, brandResearch, productResearch, product])

  const clearAvatars = useCallback(() => {
    setSelectedAvatars([])
    setAvatarEditing(false)
    setAvatarCreating(false)
    setAvatarSuggestions([])
    setCreatives([])
  }, [])

  // ─── Generation ───────────────────────────────────────────────────────

  // Generate ideas for a single avatar (or no avatar), returns placeholders
  const generateForAvatar = useCallback(async (
    avatarResearch: AvatarResearch | null,
    imagePayload: { url?: string; base64?: string; mimeType: string; label: string }[],
  ): Promise<GeneratedCreative[]> => {
    const enrichedProduct = {
      ...productResearch,
      ...(avatarResearch ? { avatarContext: avatarResearch } : {}),
      guidelines: brand?.guidelines || [],
      additionalInstructions: additionalInstructions.trim() || undefined,
    }

    const ideasRes = await safeFetch('/api/adgen/ad-ideas', {
      brandResearch,
      productResearch: enrichedProduct,
      count: ideaCount + 2,
    })
    const ideas = (ideasRes.ideas as AdIdea[]).slice(0, ideaCount)
    if (!ideas || ideas.length === 0) throw new Error('No ad ideas generated')

    const placeholders: GeneratedCreative[] = []
    for (const idea of ideas) {
      for (const format of formats) {
        placeholders.push({
          id: `creative-${++creativeIdCounter}`,
          imageBase64: '', mimeType: '', imagePrompt: '',
          idea, format,
          generatedAt: new Date().toISOString(),
          _generating: true,
        })
      }
    }
    return placeholders
  }, [brandResearch, productResearch, brand, ideaCount, formats, additionalInstructions])

  const handleGenerate = useCallback(async () => {
    if (!brandResearch || !productResearch) return
    setGenerating(true)
    setSettingsCollapsed(true)

    try {
      const imagePayload = selectedImages.map((img) => ({
        url: img.source !== 'upload' ? img.src : undefined,
        base64: img.base64,
        mimeType: img.mimeType,
        label: img.label,
      }))

      // Determine avatar runs: 0 avatars = 1 run with null, 1+ = one run per avatar
      const avatarRuns: (AvatarResearch | null)[] = selectedAvatars.length === 0
        ? [null]
        : selectedAvatars.map((a) => a.research)

      setProgress('Generating ad ideas...')

      // Generate ideas for all avatar runs in parallel
      const allPlaceholderSets = await Promise.all(
        avatarRuns.map((ar) => generateForAvatar(ar, imagePayload))
      )
      const allPlaceholders = allPlaceholderSets.flat()
      const total = allPlaceholders.length

      setCreatives((prev) => [...prev, ...allPlaceholders])
      setProgress(`Generating ${total} creatives...`)
      let completed = 0

      await Promise.all(
        allPlaceholders.map(async (placeholder) => {
          try {
            const res = await safeFetch('/api/adgen/ad-creative', {
              adIdea: placeholder.idea,
              brandResearch, productResearch,
              images: imagePayload,
              format: placeholder.format,
            })
            setCreatives((prev) =>
              prev.map((c) => c.id === placeholder.id ? {
                ...c,
                imageBase64: res.imageBase64 as string,
                mimeType: res.mimeType as string,
                imagePrompt: res.imagePrompt as string,
                _generating: false,
              } : c)
            )
          } catch (err) {
            setCreatives((prev) =>
              prev.map((c) => c.id === placeholder.id ? { ...c, _generating: false, _failed: true } : c)
            )
            console.error('Creative failed:', err)
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
  }, [brandResearch, productResearch, selectedAvatars, brand, selectedImages, ideaCount, additionalInstructions, generateForAvatar])

  const handleVariation = useCallback(async (creative: GeneratedCreative, count: number) => {
    for (let i = 0; i < count; i++) {
      const res = await safeFetch('/api/adgen/vary-creative', {
        imageBase64: creative.imageBase64, mimeType: creative.mimeType, format: creative.format,
      })
      setCreatives((prev) => [{
        id: `creative-${++creativeIdCounter}`,
        imageBase64: res.imageBase64 as string, mimeType: res.mimeType as string,
        imagePrompt: `Variation of: ${creative.imagePrompt}`,
        idea: creative.idea, format: creative.format,
        generatedAt: new Date().toISOString(), parentId: creative.id,
      }, ...prev])
    }
    toast.success(`${count} variation${count > 1 ? 's' : ''} created`)
  }, [])

  const handleEdit = useCallback(async (creative: GeneratedCreative, instruction: string) => {
    const res = await safeFetch('/api/adgen/edit-creative', {
      imageBase64: creative.imageBase64, mimeType: creative.mimeType, instruction,
    })
    setCreatives((prev) => [{
      id: `creative-${++creativeIdCounter}`,
      imageBase64: res.imageBase64 as string, mimeType: res.mimeType as string,
      imagePrompt: `Edit: ${instruction}`,
      idea: creative.idea, format: creative.format,
      generatedAt: new Date().toISOString(), parentId: creative.id,
    }, ...prev])
    toast.success('Edit applied')
  }, [])

  const handleChangeFormat = useCallback(async (creative: GeneratedCreative) => {
    const targetFormat = creative.format === '1:1' ? '9:16' : '1:1'
    const res = await safeFetch('/api/adgen/change-format', {
      imageBase64: creative.imageBase64, mimeType: creative.mimeType, targetFormat,
    })
    setCreatives((prev) => [{
      id: `creative-${++creativeIdCounter}`,
      imageBase64: res.imageBase64 as string, mimeType: res.mimeType as string,
      imagePrompt: `Format change: ${creative.format} → ${targetFormat}`,
      idea: creative.idea, format: targetFormat,
      generatedAt: new Date().toISOString(), parentId: creative.id,
    }, ...prev])
    toast.success(`Reformatted to ${targetFormat}`)
  }, [])

  const handleSaveToLibrary = useCallback(async (creative: GeneratedCreative) => {
    await safeFetch('/api/adgen/library', {
      brandUrl: brand?.domain || '', productUrl: product?.url || '',
      idea: creative.idea, imagePrompt: creative.imagePrompt,
      generatedBy: 'gemini-3-pro', adFormat: creative.format,
      imageBase64: creative.imageBase64, mimeType: creative.mimeType,
    })
    toast.success('Saved to library')
  }, [brand, product])

  // ─── Derived state ────────────────────────────────────────────────────

  const brandReady = brand !== null && brandResearch !== null
  const productReady = product !== null && productResearch !== null
  const canGenerate = brandReady && productReady && !generating
  const showSettings = brandReady && productReady
  const [settingsCollapsed, setSettingsCollapsed] = useState(false)
  const [promptSettingsOpen, setPromptSettingsOpen] = useState(false)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wand2 className="h-6 w-6" /> Creative Strategist
        </h1>
        <button
          type="button"
          onClick={() => setPromptSettingsOpen(true)}
          className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Prompt Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <PromptSettingsModal open={promptSettingsOpen} onClose={() => setPromptSettingsOpen(false)} />

      {/* Selection rows */}
      <div className="space-y-1 mb-6">
        {/* ─── Brand row ─── */}
        <Row
          label="Brand"
          selected={brandReady && !newBrand}
          selectedLabel={brandResearch?.brandName}
          selectedSublabel={brand?.domain}
          onClear={clearBrand}
          onEdit={() => setBrandEditing(!brandEditing)}
          editing={brandEditing}
          loading={brandLoading && !brandResearch}
          editPanel={brand && brandResearch ? (
            <>
              <ResearchCard
                type="brand"
                research={brandResearch}
                onChange={setBrandResearch}
              />
              <div>
                <label className="text-xs font-medium text-muted-foreground">Guidelines & Restrictions</label>
                <p className="text-xs text-muted-foreground mb-2">Rules the AI follows when generating ads</p>
                <GuidelinesEditor
                  guidelines={brandGuidelines}
                  onChange={setBrandGuidelines}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setBrandEditing(false)}>Cancel</Button>
                <Button size="sm" onClick={updateBrand}>Save Changes</Button>
              </div>
            </>
          ) : undefined}
        >
          {/* Search / new brand */}
          {!newBrand ? (
            <InlineSearch<CSBrand>
              placeholder="Search brands or type to create..."
              onSearch={searchBrands}
              onSelect={selectBrand}
              onCreate={startNewBrand}
              renderItem={(b) => ({ label: b.brand_name, sublabel: b.domain })}
              createLabel={(q) => `Create new brand "${q}"`}
              loading={brandLoading}
            />
          ) : (
            <div className="flex-1 space-y-3 rounded-lg border bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Brand Name</label>
                  <Input value={newBrand.name} onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })} className="mt-1 text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Domain URL</label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="example.com"
                      value={newBrand.domain}
                      onChange={(e) => setNewBrand({ ...newBrand, domain: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newBrand.domain.trim()) researchBrand() }}
                      className="text-sm h-9"
                    />
                    <Button size="sm" variant="outline" onClick={researchBrand} disabled={!newBrand.domain.trim() || researchLoading}>
                      {researchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
              {(brandResearch || researchLoading) && (
                <ResearchCard
                  type="brand"
                  research={brandResearch ?? { brandName: '', industry: '', targetAudience: '', valueProposition: '', brandVoice: '', keyMessages: [], competitiveAdvantages: [], productCategories: [], pricePoint: '', brandPersonality: [] }}
                  onChange={setBrandResearch}
                  loading={researchLoading}
                />
              )}
              {brandResearch && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Guidelines & Restrictions</label>
                  <GuidelinesEditor guidelines={newBrand.guidelines} onChange={(g) => setNewBrand({ ...newBrand, guidelines: g })} />
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setNewBrand(null)}>Cancel</Button>
                <Button size="sm" onClick={saveBrand} disabled={!brandResearch || !newBrand.domain.trim() || brandLoading}>
                  {brandLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Save Brand
                </Button>
              </div>
            </div>
          )}
        </Row>

        {/* ─── Product row ─── */}
        <Row
          label="Product"
          selected={productReady}
          selectedLabel={productResearch?.productName}
          selectedSublabel={product?.type}
          onClear={clearProduct}
          onEdit={() => setProductEditing(!productEditing)}
          editing={productEditing}
          loading={productLoading && !productResearch}
          editPanel={productResearch ? (
            <>
              <ResearchCard
                type="product"
                research={productResearch}
                onChange={setProductResearch}
              />
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setProductEditing(false)}>Done</Button>
              </div>
            </>
          ) : undefined}
        >
          {brandReady && (
            <InlineSearch<CSProduct>
              placeholder="Search products or paste a URL..."
              onSearch={searchProducts}
              onSelect={selectProduct}
              onCreate={(q) => addProductFromUrl(q)}
              onUrlSubmit={addProductFromUrl}
              renderItem={(p) => ({ label: p.name, sublabel: p.url })}
              createLabel={(q) => `Add product "${q}"`}
              urlLabel={(q) => `Research & add this URL`}
              loading={productLoading}
              detectUrl
            />
          )}
          {!brandReady && (
            <span className="text-sm text-muted-foreground">Select a brand first</span>
          )}
        </Row>

        {/* ─── Avatar row ─── */}
        <div className="space-y-0">
          <div className="flex items-center gap-3 min-h-[44px]">
            <span className="text-sm font-semibold text-muted-foreground w-[100px] shrink-0">Avatar</span>
            <div className="flex-1 min-w-0">
              {brandReady && productReady ? (
                <AvatarSelect
                  avatars={avatars}
                  selected={selectedAvatars}
                  onSelectionChange={setSelectedAvatars}
                  onCreateNew={startAvatarCreation}
                  loading={avatarsLoading}
                />
              ) : (
                <span className="text-sm text-muted-foreground">
                  {!brandReady ? 'Select a brand first' : 'Select a product first'}
                </span>
              )}
            </div>
            {selectedAvatars.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setAvatarEditing(!avatarEditing)}
                  className={cn(
                    'rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                    avatarEditing && 'text-primary bg-primary/10'
                  )}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={clearAvatars}
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>

          {/* Avatar edit panel — show selected avatar details */}
          {avatarEditing && selectedAvatars.length > 0 && (
            <div className="ml-[112px] mt-1 mb-2 space-y-3">
              {selectedAvatars.map((a) => (
                <div key={a.id} className="rounded-lg border bg-white p-4 space-y-2 text-xs">
                  <p className="text-sm font-medium">{a.name}</p>
                  {a.research.demographics && <p><span className="font-medium">Demographics:</span> {a.research.demographics}</p>}
                  {a.research.coreProblem && <p><span className="font-medium">Core problem:</span> {a.research.coreProblem}</p>}
                  {a.research.painPoints?.length > 0 && <p><span className="font-medium">Pain points:</span> {a.research.painPoints.join(', ')}</p>}
                  {a.research.desires?.length > 0 && <p><span className="font-medium">Desires:</span> {a.research.desires.join(', ')}</p>}
                  {a.research.buyingTriggers?.length > 0 && <p><span className="font-medium">Buying triggers:</span> {a.research.buyingTriggers.join(', ')}</p>}
                  {a.research.objections?.length > 0 && <p><span className="font-medium">Objections:</span> {a.research.objections.join(', ')}</p>}
                  {a.research.innerMonologue && <p className="italic text-muted-foreground">{a.research.innerMonologue.slice(0, 300)}...</p>}
                </div>
              ))}
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setAvatarEditing(false)}>Done</Button>
              </div>
            </div>
          )}

          {/* Avatar creation flow */}
          {avatarCreating && (
            <div className="ml-[112px] mt-1 mb-2 rounded-lg border bg-white p-4 space-y-4">
              {suggestionsLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating avatar suggestions...
                </div>
              )}
              {avatarSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Select an archetype to research in depth
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {avatarSuggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => deepResearchAndSave(s)}
                        disabled={deepResearchLoading !== null}
                        className={cn(
                          'w-full rounded-lg border p-3 text-left transition-all',
                          deepResearchLoading === s.name
                            ? 'border-primary bg-primary/5'
                            : 'border-dashed hover:border-primary/50 hover:bg-primary/5',
                          deepResearchLoading !== null && deepResearchLoading !== s.name && 'opacity-50'
                        )}
                      >
                        {deepResearchLoading === s.name && (
                          <div className="flex items-center gap-1.5 text-xs text-primary mb-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Deep researching...
                          </div>
                        )}
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.archetype}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.summary}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button size="sm" variant="outline" onClick={() => { setAvatarCreating(false); setAvatarSuggestions([]) }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Generation settings ─── */}
      {showSettings && (
        <div className="rounded-lg border bg-white">
          <button
            type="button"
            onClick={() => setSettingsCollapsed(!settingsCollapsed)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-xs font-medium text-muted-foreground">Generation Settings</span>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', !settingsCollapsed && 'rotate-180')} />
          </button>
          {!settingsCollapsed && <div className="space-y-4 px-4 pb-4">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Reference Images</h3>
            <ImageSelector
              productImages={productImages}
              productTitle={productTitle}
              selectedImages={selectedImages}
              onSelectedImages={setSelectedImages}
            />
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <SegmentedControl
              label="Ideas"
              options={[
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
              ]}
              value={ideaCount}
              onChange={setIdeaCount}
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Formats</p>
              <div className="inline-flex rounded-lg border p-0.5">
                {([['1:1', '1:1'], ['9:16', '9:16'], ['both', '1:1 + 9:16']] as const).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormats(val === 'both' ? ['1:1', '9:16'] : [val as '1:1' | '9:16'])}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      (val === 'both' ? formats.length === 2 : formats.length === 1 && formats[0] === val)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Additional Instructions</label>
              <Textarea
                placeholder="Any specific direction for the AI..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                className="mt-1 text-sm min-h-[60px] resize-none"
                rows={2}
              />
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={generating || formats.length === 0} className="w-full">
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {progress || 'Generating...'}</>
              : `Generate ${ideaCount * formats.length * Math.max(1, selectedAvatars.length)} Creatives`
            }
          </Button>
          </div>}
        </div>
      )}

      {/* ─── Results ─── */}
      {creatives.length > 0 && (
        <div className="mt-6">
          <ResultsPanel
            creatives={creatives}
            generating={generating}
            progress={progress}
            onVariation={handleVariation}
            onEdit={handleEdit}
            onChangeFormat={handleChangeFormat}
            onSaveToLibrary={handleSaveToLibrary}
            onGenerateMore={handleGenerate}
            onReset={() => setCreatives([])}
          />
        </div>
      )}
    </div>
  )
}

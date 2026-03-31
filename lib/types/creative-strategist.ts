import type { BrandResearch, ProductResearch, AdIdea, SelectedImage, GeneratedCreative } from './adgen'

// ─── Database row types ──────────────────────────────────────────────────

export interface CSBrand {
  id: string
  brand_name: string
  domain: string
  guidelines: string[] // rule strings like "always use warm tones"
  created_at: string
  updated_at: string
}

export interface CSProduct {
  id: string
  brand_id: string
  name: string
  url: string
  type: 'product' | 'collection'
  created_at: string
  updated_at: string
}

// Quick suggestion from avatar-suggestions API
export interface AvatarSuggestion {
  name: string
  archetype: string
  summary: string
}

// Full deep-dive research from avatar-research API
export interface AvatarResearch {
  name: string
  demographics: string
  psychographics: string
  coreProblem?: string
  emotions?: string[]
  fears?: string[]
  hurtfulQuotes?: string[]
  pastAttempts?: string[]
  avoidances?: string[]
  dreamOutcomes?: string[]
  marketBeliefs?: string
  hiddenGains?: string
  blame?: string
  innerMonologue?: string
  painPoints: string[]
  desires: string[]
  buyingTriggers: string[]
  objections: string[]
  mediaHabits: string
  brandRelationship: string
}

export interface CSAvatar {
  id: string
  brand_id: string
  name: string
  research: AvatarResearch
  products_used: string[] // cs_products IDs
  created_at: string
  updated_at: string
}

// ─── Page state ──────────────────────────────────────────────────────────

export interface CSState {
  // Selections
  brand: CSBrand | null
  product: CSProduct | null
  avatar: CSAvatar | null

  // Research (loaded from cache or generated)
  brandResearch: BrandResearch | null
  productResearch: ProductResearch | null

  // Generation
  selectedImages: SelectedImage[]
  ideaCount: number
  additionalInstructions: string
  creatives: GeneratedCreative[]
  generating: boolean
  progress: string
}

// ─── Search result types ─────────────────────────────────────────────────

export interface SearchOption<T> {
  type: 'existing' | 'create'
  label: string
  value: T | null // null for 'create' type
  query?: string // the search term, for 'create' type
}

// ─── Research types (moved from page.tsx) ─────────────────────────────────

export interface BrandResearch {
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

export interface ProductResearch {
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

export interface AdIdea {
  title: string
  coreDesire: string
  heuristic: string
  headline: string
  messagingAngle: string
  visualConcept: string
  adFormat: string
}

// ─── Image selection ──────────────────────────────────────────────────────

export type ImageLabel = 'product-reference' | 'inspiration'

export interface SelectedImage {
  id: string
  src: string // display URL (external or object URL for uploads)
  base64?: string // only for uploads (sent to API directly)
  mimeType: string
  label: ImageLabel
  source: 'product' | 'url' | 'upload'
}

// ─── Generation settings ──────────────────────────────────────────────────

export type AdFormat = '1:1' | '9:16'

export interface GenerationSettings {
  ideaCount: number // 1-4
  variationsPerIdea: number // 1-4
  format: AdFormat
}

export const DEFAULT_SETTINGS: GenerationSettings = {
  ideaCount: 3,
  variationsPerIdea: 1,
  format: '1:1',
}

// ─── Generated output ─────────────────────────────────────────────────────

export interface GeneratedCreative {
  id: string
  imageBase64: string
  mimeType: string
  imagePrompt: string
  idea: AdIdea
  format: AdFormat
  generatedAt: string
  parentId?: string // set when created via variation/edit/format-change
}

// ─── Page state ───────────────────────────────────────────────────────────

export type AdGenStep = 'url' | 'settings' | 'generating' | 'results'

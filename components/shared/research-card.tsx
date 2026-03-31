'use client'

import { useState } from 'react'
import { Pencil, Check, X, ChevronDown, Loader2, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { BrandResearch, ProductResearch } from '@/lib/types/adgen'

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

export type ResearchCardProps = BrandCardProps | ProductCardProps

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

export function ResearchCard(props: ResearchCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const isBrand = props.type === 'brand'
  const isLoading = props.loading ?? false
  const research = props.research as unknown as Record<string, unknown>
  const fields = isBrand ? BRAND_FIELDS : PRODUCT_FIELDS

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

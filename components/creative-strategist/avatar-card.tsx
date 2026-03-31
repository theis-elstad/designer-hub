'use client'

import { Check, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CSAvatar } from '@/lib/types/creative-strategist'

interface AvatarCardProps {
  avatar: CSAvatar
  selected: boolean
  onSelect: () => void
}

export function AvatarCard({ avatar, selected, onSelect }: AvatarCardProps) {
  const r = avatar.research

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border p-3 text-left transition-all hover:border-primary/50',
        selected && 'border-primary bg-primary/5 ring-1 ring-primary/20'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}>
            {selected ? <Check className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
          </div>
          <div>
            <p className="text-sm font-medium">{avatar.name}</p>
            <p className="text-xs text-muted-foreground">{r.demographics}</p>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {r.painPoints?.length > 0 && (
          <p><span className="font-medium text-foreground">Pain points:</span> {r.painPoints.slice(0, 2).join(', ')}</p>
        )}
        {r.buyingTriggers?.length > 0 && (
          <p><span className="font-medium text-foreground">Triggers:</span> {r.buyingTriggers.slice(0, 2).join(', ')}</p>
        )}
      </div>

      {avatar.products_used.length > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground/60">
          Used with {avatar.products_used.length} product{avatar.products_used.length !== 1 ? 's' : ''}
        </p>
      )}
    </button>
  )
}

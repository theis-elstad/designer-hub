'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Plus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CSAvatar } from '@/lib/types/creative-strategist'

interface AvatarSelectProps {
  avatars: CSAvatar[]
  selected: CSAvatar[]
  onSelectionChange: (avatars: CSAvatar[]) => void
  onCreateNew: () => void
  loading?: boolean
}

export function AvatarSelect({
  avatars,
  selected,
  onSelectionChange,
  onCreateNew,
  loading = false,
}: AvatarSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedIds = new Set(selected.map((a) => a.id))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (avatar: CSAvatar) => {
    if (selectedIds.has(avatar.id)) {
      onSelectionChange(selected.filter((a) => a.id !== avatar.id))
    } else {
      onSelectionChange([...selected, avatar])
    }
  }

  const label = selected.length === 0
    ? 'No Avatar'
    : selected.length === 1
      ? selected[0].name
      : `${selected.length} avatars`

  return (
    <div ref={containerRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50',
          open && 'ring-1 ring-ring'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className={cn('truncate', selected.length === 0 && 'text-muted-foreground')}>
            {label}
          </span>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-[280px] overflow-y-auto">
          {/* No avatar option */}
          <button
            type="button"
            onClick={() => { onSelectionChange([]); setOpen(false) }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
              selected.length === 0 && 'bg-muted/30'
            )}
          >
            <div className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0', selected.length === 0 ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
              {selected.length === 0 && <Check className="h-3 w-3 text-primary-foreground" />}
            </div>
            <span className="text-muted-foreground">No Avatar</span>
          </button>

          {/* Saved avatars */}
          {avatars.map((a) => {
            const isSelected = selectedIds.has(a.id)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
                  isSelected && 'bg-muted/30'
                )}
              >
                <div className={cn('h-4 w-4 rounded border flex items-center justify-center shrink-0', isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                  {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.research.demographics}</p>
                </div>
              </button>
            )
          })}

          {/* Create new */}
          <button
            type="button"
            onClick={() => { onCreateNew(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors border-t"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary font-medium">Create New Avatar</span>
          </button>
        </div>
      )}
    </div>
  )
}

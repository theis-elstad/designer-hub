'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, Plus, Check, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchableSelectProps<T> {
  placeholder: string
  onSearch: (query: string) => Promise<T[]>
  onSelect: (item: T) => void
  onCreate: (query: string) => void
  renderItem: (item: T) => { label: string; sublabel?: string }
  selected?: T | null
  createLabel?: (query: string) => string
  loading?: boolean
}

export function SearchableSelect<T>({
  placeholder,
  onSearch,
  onSelect,
  onCreate,
  renderItem,
  selected,
  createLabel = (q) => `Create "${q}"`,
  loading = false,
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T[]>([])
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)
    setOpen(true)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const items = await onSearch(value)
        setResults(items)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 200)
  }

  const handleSelect = (item: T) => {
    onSelect(item)
    setOpen(false)
    setQuery('')
  }

  const handleCreate = () => {
    onCreate(query.trim())
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { setOpen(true); handleInputChange(query) }}
          className="pl-8 text-sm"
          disabled={loading}
        />
        {(searching || loading) && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-white shadow-lg max-h-[240px] overflow-y-auto">
          {results.map((item, i) => {
            const { label, sublabel } = renderItem(item)
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(item)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{label}</p>
                  {sublabel && <p className="text-xs text-muted-foreground truncate">{sublabel}</p>}
                </div>
              </button>
            )
          })}

          {query.trim().length > 0 && (
            <button
              type="button"
              onClick={handleCreate}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors border-t"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span className="text-primary font-medium">{createLabel(query.trim())}</span>
            </button>
          )}

          {results.length === 0 && query.trim().length === 0 && !searching && (
            <p className="px-3 py-3 text-sm text-muted-foreground text-center">
              Start typing to search...
            </p>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface GuidelinesEditorProps {
  guidelines: string[]
  onChange: (guidelines: string[]) => void
}

export function GuidelinesEditor({ guidelines, onChange }: GuidelinesEditorProps) {
  const [input, setInput] = useState('')

  const addGuideline = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onChange([...guidelines, trimmed])
    setInput('')
  }

  const removeGuideline = (index: number) => {
    onChange(guidelines.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder='e.g. "Always use warm tones" or "Never mention competitors"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuideline() } }}
          className="text-sm"
        />
        <Button type="button" size="sm" variant="outline" onClick={addGuideline} disabled={!input.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {guidelines.length > 0 && (
        <div className="space-y-1">
          {guidelines.map((rule, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <span className="flex-1">{rule}</span>
              <button
                type="button"
                onClick={() => removeGuideline(i)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

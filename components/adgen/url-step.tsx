'use client'

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface UrlStepProps {
  onSubmit: (url: string) => void
}

function isValidUrl(str: string): boolean {
  if (!str.trim()) return false
  try {
    new URL(str.startsWith('http') ? str : `https://${str}`)
    return true
  } catch {
    return false
  }
}

export function UrlStep({ onSubmit }: UrlStepProps) {
  const [url, setUrl] = useState('')

  const valid = isValidUrl(url.trim())
  const normalizedUrl = url.trim().startsWith('http')
    ? url.trim()
    : `https://${url.trim()}`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Product URL</h2>
        <p className="text-sm text-muted-foreground">
          Paste a product page URL to get started.
        </p>
      </div>

      <div className="space-y-3">
        <Input
          placeholder="https://example.com/products/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) onSubmit(normalizedUrl)
          }}
          className="text-base"
          autoFocus
        />
        <Button
          onClick={() => onSubmit(normalizedUrl)}
          disabled={!valid}
          className="w-full"
          size="lg"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Continue
        </Button>
      </div>
    </div>
  )
}

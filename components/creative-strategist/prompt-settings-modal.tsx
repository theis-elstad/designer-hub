'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, ChevronDown, RotateCcw, Save, Loader2, History, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface PromptVersion {
  id: string
  slug: string
  version: number
  is_active: boolean
  title: string
  description: string
  system_prompt: string
  user_prompt_template: string | null
  created_at: string
  created_by: string | null
}

interface PromptSettingsModalProps {
  open: boolean
  onClose: () => void
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString()
}

function PromptEditor({ prompt, onSaved }: { prompt: PromptVersion; onSaved: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(prompt.system_prompt)
  const [saving, setSaving] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [reverting, setReverting] = useState<number | null>(null)

  const hasChanges = draft !== prompt.system_prompt

  const loadHistory = useCallback(async () => {
    setLoadingVersions(true)
    try {
      const res = await fetch(`/api/cs/prompts?slug=${prompt.slug}&allVersions=true`)
      const data = await res.json()
      setVersions(data.prompts || [])
    } catch {
      toast.error('Failed to load version history')
    } finally {
      setLoadingVersions(false)
    }
  }, [prompt.slug])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/cs/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: prompt.slug, system_prompt: draft }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(`Prompt "${prompt.title}" updated (v${prompt.version + 1})`)
      setEditing(false)
      onSaved()
    } catch {
      toast.error('Failed to save prompt')
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = async (version: number) => {
    setReverting(version)
    try {
      const res = await fetch('/api/cs/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: prompt.slug, version }),
      })
      if (!res.ok) throw new Error('Failed to revert')
      toast.success(`Reverted "${prompt.title}" to v${version}`)
      setShowHistory(false)
      onSaved()
    } catch {
      toast.error('Failed to revert')
    } finally {
      setReverting(null)
    }
  }

  return (
    <div className="rounded-lg border bg-white">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{prompt.title}</h3>
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">v{prompt.version}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{prompt.description}</p>
        </div>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform', expanded && 'rotate-180')} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t">
          <div className="pt-3">
            {editing ? (
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="font-mono text-xs min-h-[200px] resize-y"
                rows={12}
              />
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/40 rounded-md p-3 max-h-[300px] overflow-y-auto">
                {prompt.system_prompt}
              </pre>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(false); setDraft(prompt.system_prompt) }}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Save as v{prompt.version + 1}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  Edit Prompt
                </Button>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowHistory(!showHistory)
                if (!showHistory && versions.length === 0) loadHistory()
              }}
              className="text-xs"
            >
              <History className="h-3.5 w-3.5 mr-1.5" />
              {showHistory ? 'Hide History' : 'Version History'}
            </Button>
          </div>

          {/* Version history */}
          {showHistory && (
            <div className="rounded-md border bg-muted/20 divide-y max-h-[250px] overflow-y-auto">
              {loadingVersions ? (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading versions...
                </div>
              ) : versions.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No version history yet.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'text-xs font-mono font-medium',
                        v.is_active ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        v{v.version}
                      </span>
                      {v.is_active && <Check className="h-3 w-3 text-primary" />}
                      <span className="text-[10px] text-muted-foreground">{timeAgo(v.created_at)}</span>
                    </div>
                    {!v.is_active && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevert(v.version)}
                        disabled={reverting !== null}
                        className="h-6 text-xs px-2"
                      >
                        {reverting === v.version ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <><RotateCcw className="h-3 w-3 mr-1" /> Revert</>
                        )}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PromptSettingsModal({ open, onClose }: PromptSettingsModalProps) {
  const [prompts, setPrompts] = useState<PromptVersion[]>([])
  const [loading, setLoading] = useState(true)

  const loadPrompts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/cs/prompts')
      const data = await res.json()
      setPrompts(data.prompts || [])
    } catch {
      toast.error('Failed to load prompts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadPrompts()
  }, [open, loadPrompts])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] pb-[5vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border bg-gray-50 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-white rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold">Prompt Settings</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              View and edit the AI prompts used throughout Creative Strategist
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading prompts...
            </div>
          ) : prompts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">No prompts found.</p>
          ) : (
            prompts.map((p) => (
              <PromptEditor key={p.id} prompt={p} onSaved={loadPrompts} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

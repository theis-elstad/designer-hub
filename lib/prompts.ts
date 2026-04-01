import { createClient } from '@/lib/supabase/server'

interface PromptRecord {
  slug: string
  system_prompt: string
  user_prompt_template: string | null
}

// In-memory cache (per-request in edge, but helps in Node)
const cache = new Map<string, { prompt: PromptRecord; ts: number }>()
const CACHE_TTL = 60_000 // 1 minute

export async function getActivePrompt(slug: string): Promise<PromptRecord | null> {
  const cached = cache.get(slug)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.prompt

  try {
    const supabase = await createClient()
    const { data } = await (supabase as any)
      .from('cs_prompts')
      .select('slug, system_prompt, user_prompt_template')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (data) {
      cache.set(slug, { prompt: data, ts: Date.now() })
      return data
    }
  } catch {
    // Fall through to null
  }

  return null
}

export async function getSystemPrompt(slug: string, fallback: string): Promise<string> {
  const record = await getActivePrompt(slug)
  return record?.system_prompt ?? fallback
}

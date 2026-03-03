import type { AsanaTask, AsanaSection, AsanaListResponse } from '@/lib/types/asana'

const ASANA_BASE_URL = 'https://app.asana.com/api/1.0'

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function asanaFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = process.env.ASANA_PAT
  if (!token) {
    throw new Error('ASANA_PAT environment variable is not set')
  }

  const url = new URL(`${ASANA_BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  // Handle rate limiting — wait and retry once
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 30_000
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 60_000)))

    const retryResponse = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })

    if (!retryResponse.ok) {
      throw new Error(`Asana API error ${retryResponse.status} (after retry): ${await retryResponse.text()}`)
    }
    return retryResponse.json()
  }

  if (response.status === 401) {
    throw new Error('Invalid Asana token — check your ASANA_PAT environment variable')
  }
  if (response.status === 403) {
    throw new Error('Access denied to Asana resource — check PAT permissions')
  }
  if (!response.ok) {
    throw new Error(`Asana API error ${response.status}: ${await response.text()}`)
  }

  return response.json()
}

// ---------------------------------------------------------------------------
// Project tasks — paginated
// ---------------------------------------------------------------------------

export async function getProjectTasks(
  projectGid: string,
  optFields: string[]
): Promise<AsanaTask[]> {
  const allTasks: AsanaTask[] = []
  let offset: string | undefined

  do {
    const params: Record<string, string> = {
      opt_fields: optFields.join(','),
      limit: '100',
    }
    if (offset) {
      params.offset = offset
    }

    const response = await asanaFetch<AsanaListResponse<AsanaTask>>(
      `/projects/${projectGid}/tasks`,
      params
    )

    allTasks.push(...response.data)
    offset = response.next_page?.offset
  } while (offset)

  return allTasks
}

// ---------------------------------------------------------------------------
// Project sections
// ---------------------------------------------------------------------------

export async function getProjectSections(projectGid: string): Promise<AsanaSection[]> {
  const response = await asanaFetch<AsanaListResponse<AsanaSection>>(
    `/projects/${projectGid}/sections`,
    { opt_fields: 'name' }
  )
  return response.data
}

// ---------------------------------------------------------------------------
// Section tasks
// ---------------------------------------------------------------------------

export async function getSectionTasks(
  sectionGid: string,
  optFields: string[]
): Promise<AsanaTask[]> {
  const allTasks: AsanaTask[] = []
  let offset: string | undefined

  do {
    const params: Record<string, string> = {
      opt_fields: optFields.join(','),
      limit: '100',
    }
    if (offset) {
      params.offset = offset
    }

    const response = await asanaFetch<AsanaListResponse<AsanaTask>>(
      `/sections/${sectionGid}/tasks`,
      params
    )

    allTasks.push(...response.data)
    offset = response.next_page?.offset
  } while (offset)

  return allTasks
}

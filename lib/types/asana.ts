// ============================================================
// Asana API response types
// ============================================================

export interface AsanaTask {
  gid: string
  name: string
  due_on: string | null // "YYYY-MM-DD"
  completed: boolean
  assignee: { gid: string; name: string } | null
  custom_fields: AsanaCustomField[]
  permalink_url: string
}

export interface AsanaCustomField {
  gid: string
  name: string
  display_value: string | null
  type: string
}

export interface AsanaSection {
  gid: string
  name: string
}

export interface AsanaPageInfo {
  offset: string
  path: string
  uri: string
}

export interface AsanaListResponse<T> {
  data: T[]
  next_page: AsanaPageInfo | null
}

// ============================================================
// Processed / aggregated data for the UI
// ============================================================

export interface OverdueTaskInfo {
  gid: string
  name: string
  dueOn: string
  stage: string | null
  permalink: string
}

/**
 * A flat entry representing one (designer, pod) combination.
 * Designers with tasks in multiple pods will have multiple entries.
 */
export interface TaskEntry {
  designerName: string
  designerGid: string
  podName: string
  overdueCount: number
  overdueTasks: OverdueTaskInfo[]
  stageCounts: Record<string, number>
}

export interface OverduePageData {
  entries: TaskEntry[]
  allStages: string[]
  projectUrl: string
  lastUpdated: string
}

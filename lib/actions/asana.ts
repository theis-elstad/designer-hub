'use server'

import { createClient } from '@/lib/supabase/server'
import { getProjectTasks } from '@/lib/asana'
import type {
  AsanaTask,
  AsanaCustomField,
  TaskEntry,
  OverdueTaskInfo,
  OverduePageData,
} from '@/lib/types/asana'
import { isBefore, parseISO, startOfDay } from 'date-fns'

// ---------------------------------------------------------------------------
// Asana project GIDs
// ---------------------------------------------------------------------------

const TASKS_PROJECT_GID = '1211038966535046'

// Only tasks in these stages count as overdue (when due date is in the past)
// Stored lowercase — compared case-insensitively against Asana's display_value
const OVERDUE_STAGES = ['in progress', 'in review']

// Fields we need from the tasks project
const TASK_OPT_FIELDS = [
  'name',
  'due_on',
  'assignee',
  'assignee.name',
  'custom_fields',
  'custom_fields.name',
  'custom_fields.display_value',
  'custom_fields.type',
  'permalink_url',
  'completed',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract a custom field's display_value by field name from a task. */
function getFieldValue(task: AsanaTask, fieldName: string): string | null {
  const field = task.custom_fields?.find(
    (f: AsanaCustomField) => f.name?.toLowerCase() === fieldName.toLowerCase()
  )
  return field?.display_value ?? null
}

// ---------------------------------------------------------------------------
// Main server action
// ---------------------------------------------------------------------------

export async function getOverdueTaskData(): Promise<OverduePageData | { error: string }> {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  try {
    // ------------------------------------------------------------------
    // 1. Fetch all tasks from the project
    // ------------------------------------------------------------------
    const allTasks = await getProjectTasks(TASKS_PROJECT_GID, TASK_OPT_FIELDS)

    // ------------------------------------------------------------------
    // 2. Process all tasks — filter, classify, aggregate
    //    Track data per (designer, pod) combination so designers with
    //    tasks in multiple pods appear in each pod correctly.
    // ------------------------------------------------------------------
    const today = startOfDay(new Date())

    // Only look at incomplete tasks
    const activeTasks = allTasks.filter((t) => !t.completed)

    // Collect all stage names we encounter
    const stageSet = new Set<string>()

    // Key: "designerGid::podName" → TaskEntry
    const entryMap = new Map<string, TaskEntry>()

    for (const task of activeTasks) {
      const assigneeName = task.assignee?.name ?? 'Unassigned'
      const assigneeGid = task.assignee?.gid ?? 'unassigned'

      // PODid can be a multi-select field — display_value joins values with ", "
      // Split so each pod gets its own entry (e.g. "POD ANGUS, POD MOSKUS" → two pods)
      const rawPod = getFieldValue(task, 'PODid')
      const podNames = rawPod
        ? rawPod.split(',').map((p) => p.trim()).filter(Boolean)
        : ['Unassigned Pod']

      const stage = getFieldValue(task, 'Stage')

      // Pre-compute overdue info once per task
      let isOverdue = false
      if (task.due_on) {
        try {
          const dueDate = parseISO(task.due_on)
          if (isBefore(dueDate, today)) {
            isOverdue =
              stage != null && OVERDUE_STAGES.includes(stage.toLowerCase())
          }
        } catch {
          // Skip unparseable dates
        }
      }

      // Track stage name globally
      if (stage) {
        stageSet.add(stage)
      }

      // Record this task under each pod it belongs to
      for (const podName of podNames) {
        const key = `${assigneeGid}::${podName}`

        if (!entryMap.has(key)) {
          entryMap.set(key, {
            designerName: assigneeName,
            designerGid: assigneeGid,
            podName,
            overdueCount: 0,
            overdueTasks: [],
            stageCounts: {},
          })
        }

        const entry = entryMap.get(key)!

        if (stage) {
          entry.stageCounts[stage] = (entry.stageCounts[stage] || 0) + 1
        }

        if (isOverdue && stage) {
          entry.overdueCount++
          entry.overdueTasks.push({
            gid: task.gid,
            name: task.name,
            dueOn: task.due_on!,
            stage,
            permalink: task.permalink_url,
          })
        }
      }
    }

    // Sort overdue tasks within each entry by due date (oldest first)
    for (const entry of entryMap.values()) {
      entry.overdueTasks.sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    }

    // Collect all stage names sorted alphabetically
    const allStages = Array.from(stageSet).sort()

    return {
      entries: Array.from(entryMap.values()),
      allStages,
      projectUrl: `https://app.asana.com/0/${TASKS_PROJECT_GID}`,
      lastUpdated: new Date().toISOString(),
    }
  } catch (err) {
    console.error('Asana fetch error:', err)
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch Asana data',
    }
  }
}

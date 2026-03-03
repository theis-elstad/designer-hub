'use client'

import { useState, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Info } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import type { OverduePageData, TaskEntry } from '@/lib/types/asana'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewMode = 'pods' | 'designers'
type SortDirection = 'asc' | 'desc'

interface AggregatedRow {
  key: string
  name: string
  overdueCount: number
  stageCounts: Record<string, number>
}

interface OverdueDashboardProps {
  data: OverduePageData
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------

function aggregateByPod(entries: TaskEntry[], allStages: string[]): AggregatedRow[] {
  const map = new Map<string, AggregatedRow>()
  for (const entry of entries) {
    if (!map.has(entry.podName)) {
      map.set(entry.podName, {
        key: entry.podName,
        name: entry.podName,
        overdueCount: 0,
        stageCounts: {},
      })
    }
    const row = map.get(entry.podName)!
    row.overdueCount += entry.overdueCount
    for (const stage of allStages) {
      row.stageCounts[stage] =
        (row.stageCounts[stage] ?? 0) + (entry.stageCounts[stage] ?? 0)
    }
  }
  return Array.from(map.values())
}

function aggregateByDesigner(entries: TaskEntry[], allStages: string[]): AggregatedRow[] {
  const map = new Map<string, AggregatedRow>()
  for (const entry of entries) {
    if (!map.has(entry.designerGid)) {
      map.set(entry.designerGid, {
        key: entry.designerGid,
        name: entry.designerName,
        overdueCount: 0,
        stageCounts: {},
      })
    }
    const row = map.get(entry.designerGid)!
    row.overdueCount += entry.overdueCount
    for (const stage of allStages) {
      row.stageCounts[stage] =
        (row.stageCounts[stage] ?? 0) + (entry.stageCounts[stage] ?? 0)
    }
  }
  return Array.from(map.values())
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverdueDashboard({ data }: OverdueDashboardProps) {
  const { entries, allStages, projectUrl, lastUpdated } = data

  const [activeView, setActiveView] = useState<ViewMode>('pods')
  const [sortColumn, setSortColumn] = useState('overdue')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Aggregate rows based on active view
  const rows: AggregatedRow[] = useMemo(() => {
    return activeView === 'pods'
      ? aggregateByPod(entries, allStages)
      : aggregateByDesigner(entries, allStages)
  }, [entries, allStages, activeView])

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...rows]
    sorted.sort((a, b) => {
      let cmp = 0
      if (sortColumn === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortColumn === 'overdue') {
        cmp = a.overdueCount - b.overdueCount
      } else {
        // Stage column
        const aVal = a.stageCounts[sortColumn] ?? 0
        const bVal = b.stageCounts[sortColumn] ?? 0
        cmp = aVal - bVal
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [rows, sortColumn, sortDirection])

  // Totals for the summary row
  const totals = useMemo(() => {
    const result: { overdue: number; stages: Record<string, number> } = {
      overdue: 0,
      stages: {},
    }
    for (const row of rows) {
      result.overdue += row.overdueCount
      for (const stage of allStages) {
        result.stages[stage] = (result.stages[stage] ?? 0) + (row.stageCounts[stage] ?? 0)
      }
    }
    return result
  }, [rows, allStages])

  // Handle column header click
  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDirection(column === 'name' ? 'asc' : 'desc')
    }
  }

  // Reset sort when switching views
  function handleViewChange(view: string) {
    setActiveView(view as ViewMode)
    setSortColumn('overdue')
    setSortDirection('desc')
  }

  // Sort indicator icon
  function SortIcon({ column }: { column: string }) {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    )
  }

  const nameColumnLabel = activeView === 'pods' ? 'Pod' : 'Designer'

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header row: Asana link + last updated */}
        <div className="flex items-center justify-between text-sm">
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View full project in Asana
          </a>
          <span className="text-muted-foreground text-xs">
            Updated {formatDistanceToNow(parseISO(lastUpdated), { addSuffix: true })}
          </span>
        </div>

        {/* Pods / Designers toggle */}
        <Tabs value={activeView} onValueChange={handleViewChange}>
          <TabsList variant="line">
            <TabsTrigger value="pods" className="text-sm px-4 py-1.5">
              Pods
            </TabsTrigger>
            <TabsTrigger value="designers" className="text-sm px-4 py-1.5">
              Designers
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Data table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                  >
                    {nameColumnLabel}
                    <SortIcon column="name" />
                  </button>
                </TableHead>
                <TableHead className="text-right">
                  <button
                    onClick={() => handleSort('overdue')}
                    className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                  >
                    Overdue
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/70" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-60 text-center">
                        Tasks are overdue when the due date is in the past and the
                        stage is &quot;In progress&quot; or &quot;In review&quot;.
                      </TooltipContent>
                    </Tooltip>
                    <SortIcon column="overdue" />
                  </button>
                </TableHead>
                {allStages.map((stage) => (
                  <TableHead key={stage} className="text-right">
                    <button
                      onClick={() => handleSort(stage)}
                      className="flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors"
                    >
                      {stage}
                      <SortIcon column={stage} />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2 + allStages.length}
                    className="text-center text-muted-foreground py-8"
                  >
                    No task data found. Check that the Asana PAT has access to the project.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium text-sm">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {row.overdueCount > 0 ? (
                        <span className="text-red-600 font-semibold">{row.overdueCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    {allStages.map((stage) => {
                      const count = row.stageCounts[stage] ?? 0
                      return (
                        <TableCell key={stage} className="text-right tabular-nums text-sm">
                          {count > 0 ? count : <span className="text-muted-foreground">0</span>}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>

            {sortedRows.length > 0 && (
              <TableFooter>
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell className="text-sm">Total</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {totals.overdue > 0 ? (
                      <span className="text-red-600">{totals.overdue}</span>
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  {allStages.map((stage) => (
                    <TableCell key={stage} className="text-right tabular-nums text-sm">
                      {totals.stages[stage] ?? 0}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>
    </TooltipProvider>
  )
}

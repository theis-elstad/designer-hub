'use client'

import { format } from 'date-fns'
import { MessageSquare } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { FeedbackRow } from '@/lib/actions/feedback'

interface FeedbackTableProps {
  rows: FeedbackRow[]
}

export function FeedbackTable({ rows }: FeedbackTableProps) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No submissions found for this time range.</p>
        </CardContent>
      </Card>
    )
  }

  // Find the latest row that has judge feedback
  const latestFeedbackIndex = rows.findIndex((r) => r.judgeComment)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Submissions &amp; Ratings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-center">Statics</TableHead>
                <TableHead className="text-center">Videos</TableHead>
                <TableHead className="text-center">Productivity</TableHead>
                <TableHead className="text-center">Quality</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead>Judge Feedback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const isHighlighted = index === latestFeedbackIndex
                const date = new Date(row.submissionDate + 'T00:00:00')
                return (
                  <TableRow
                    key={row.submissionDate}
                    className={isHighlighted ? 'bg-blue-50' : undefined}
                  >
                    <TableCell className="font-medium whitespace-nowrap">
                      {format(date, 'EEE, MMM d')}
                    </TableCell>
                    <TableCell className="text-center">{row.staticCount}</TableCell>
                    <TableCell className="text-center">{row.videoCount}</TableCell>
                    <TableCell className="text-center">
                      {row.productivity !== null ? row.productivity : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.quality !== null ? row.quality : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {row.totalScore !== null ? row.totalScore : (
                        <span className="text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {row.judgeComment ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-start gap-1.5 cursor-pointer">
                                <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
                                <span className="text-sm text-gray-700 line-clamp-2">
                                  {row.judgeComment}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-sm bg-white text-gray-800 text-sm border border-gray-200 shadow-lg p-3"
                            >
                              {row.judgeComment}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : row.productivity !== null ? (
                        <span className="text-xs text-gray-400">No feedback</span>
                      ) : (
                        <span className="text-xs text-gray-300">Not rated</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

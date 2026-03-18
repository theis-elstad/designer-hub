'use client'

import { Medal, Trophy } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getAvatarUrl } from '@/lib/utils'
import type { LeaderboardEntry } from '@/lib/types/database'

interface WeeklyWinnerTableProps {
  entries: LeaderboardEntry[]
  onAssetClick?: (userId: string, designerName: string) => void
}

function formatScore(score: number) {
  return score.toFixed(1)
}

function getInitials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map((n) => n[0]).join('').toUpperCase()
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <div className="flex items-center justify-center w-8 h-8 shrink-0"><Trophy className="h-6 w-6 text-yellow-500" /></div>
  if (rank === 2) return <div className="flex items-center justify-center w-8 h-8 shrink-0"><Medal className="h-6 w-6 text-gray-400" /></div>
  if (rank === 3) return <div className="flex items-center justify-center w-8 h-8 shrink-0"><Medal className="h-6 w-6 text-orange-400" /></div>
  return <div className="flex items-center justify-center w-8 h-8 shrink-0"><span className="text-gray-500 font-medium">{rank}</span></div>
}

export function WeeklyWinnerTable({ entries, onAssetClick }: WeeklyWinnerTableProps) {
  if (entries.length === 0) {
    return <div className="text-center py-12 text-gray-500">No submissions this week yet.</div>
  }

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-4 px-4 sm:px-6 py-3 border-b bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <div className="w-8 shrink-0" />
        <div className="w-9 shrink-0" />
        <div className="flex-1 min-w-0">Name</div>
        <div className="w-14 text-center shrink-0">Statics</div>
        <div className="w-14 text-center shrink-0">Videos</div>
        <div className="w-20 text-center shrink-0">Avg Prod</div>
        <div className="w-20 text-center shrink-0">Avg Qual</div>
        <div className="w-20 text-center shrink-0">Avg Total</div>
      </div>

      {/* Entries */}
      <div className="divide-y">
        {entries.map((entry) => {
          const avatarUrl = getAvatarUrl(entry.avatar_path)
          const isTopThree = entry.rank <= 3

          return (
            <div
              key={entry.user_id}
              data-rank={entry.rank}
              className={cn(
                'flex items-center gap-4 px-4 sm:px-6 py-3',
                entry.rank === 1 && 'bg-yellow-50/50',
                entry.rank === 2 && 'bg-gray-50/50',
                entry.rank === 3 && 'bg-gray-50/50',
              )}
            >
              <RankBadge rank={entry.rank} />

              <Avatar data-anon="blur" className={cn(
                'h-9 w-9 shrink-0',
                entry.rank === 1 && 'ring-2 ring-yellow-500',
                entry.rank === 2 && 'ring-2 ring-gray-400',
                entry.rank === 3 && 'ring-2 ring-orange-400',
              )}>
                {avatarUrl && <AvatarImage src={avatarUrl} alt={entry.full_name || 'Avatar'} />}
                <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">{getInitials(entry.full_name)}</AvatarFallback>
              </Avatar>

              <div data-anon="blur" className="flex-1 min-w-0">
                <p className={cn('truncate', isTopThree ? 'font-semibold' : 'font-medium')}>
                  {entry.full_name || 'Unknown'}
                </p>
              </div>

              {/* Statics - clickable */}
              <div className="w-14 text-center shrink-0">
                <button
                  onClick={() => onAssetClick?.(entry.user_id, entry.full_name || 'Unknown')}
                  className="text-sm text-gray-600 hover:text-blue-600 hover:underline cursor-pointer"
                >
                  {entry.static_count || 0}
                </button>
              </div>

              {/* Videos - clickable */}
              <div className="w-14 text-center shrink-0">
                <button
                  onClick={() => onAssetClick?.(entry.user_id, entry.full_name || 'Unknown')}
                  className="text-sm text-gray-600 hover:text-blue-600 hover:underline cursor-pointer"
                >
                  {entry.video_count || 0}
                </button>
              </div>

              {/* Avg Productivity */}
              <div className="w-20 text-center shrink-0">
                <span className="text-gray-600">{formatScore(entry.avg_productivity)}</span>
              </div>

              {/* Avg Quality */}
              <div className="w-20 text-center shrink-0">
                <span className="text-gray-600">{formatScore(entry.avg_quality)}</span>
              </div>

              {/* Avg Total */}
              <div className="w-20 text-center shrink-0">
                <span className={cn(
                  'font-bold text-lg',
                  entry.rank === 1 && 'text-yellow-600',
                  entry.rank === 2 && 'text-gray-600',
                  entry.rank === 3 && 'text-orange-600',
                )}>
                  {formatScore(entry.avg_total_score)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

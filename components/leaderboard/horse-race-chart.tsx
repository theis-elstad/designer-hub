'use client'

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { getAvatarUrl } from '@/lib/utils'
import type { LeaderboardEntry } from '@/lib/types/database'

interface WeekDay {
  date: string
  label: string
  entries: LeaderboardEntry[]
}

interface HorseRaceChartProps {
  weekDays: WeekDay[]
  weeklyEntries: LeaderboardEntry[]
}

const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c',
  '#0891b2', '#c026d3', '#65a30d', '#e11d48', '#0d9488',
  '#7c3aed', '#ca8a04', '#4f46e5', '#be123c', '#059669',
  '#d97706', '#6366f1', '#db2777', '#84cc16', '#14b8a6',
]

const GOLD = '#ca8a04'
const LABEL_HEIGHT = 24
const AVATAR_SIZE = 18

interface DayPoint {
  [key: string]: number | string | boolean | undefined
}

interface Designer {
  id: string
  name: string
  color: string
  avatarUrl: string | undefined
}

// Compute a rank-based offset for each designer's end label so they don't overlap.
// Returns a map of designerId -> pixel offset from their actual cy position.
function computeLabelOffsets(
  designers: Designer[],
  lastPoint: DayPoint,
): Map<string, number> {
  // Collect designers with their final values
  const items: Array<{ id: string; value: number }> = []
  for (const d of designers) {
    const val = lastPoint[d.id] as number | undefined
    if (val != null) items.push({ id: d.id, value: val })
  }

  if (items.length <= 1) return new Map(items.map((i) => [i.id, 0]))

  // Sort descending by value (highest score first = lowest cy in SVG)
  items.sort((a, b) => b.value - a.value)

  // For each pair, check if they'd overlap in pixel space.
  // We don't know the exact scale, but we know the Y axis maps values to pixels.
  // So we work in "slot" space: assign each label a slot, then compute offsets.
  // The slot position = index * LABEL_HEIGHT. The natural position = proportional to value.
  // Offset = slot position - natural position (in relative terms).

  // We'll use a simpler approach: for the last data point, compute where each
  // label *should* go (evenly spaced) vs where it *naturally* goes (at cy).
  // The custom dot renderer will shift the label by the offset.

  // Since we can't know pixel scale here, we compute offsets that the dot renderer
  // applies only when it detects collision at render time. Instead, we assign
  // each designer a "rank" index at the endpoint, and the dot renderer uses
  // a shared coordinate collector.

  // Simplest robust approach: assign each designer a target slot index.
  // The dot renderer for the last point will look at ALL last-point dots
  // in the DOM and reposition labels to avoid overlap.

  // Actually — let's just return the sorted rank order. The dot renderer
  // can use this to know its position relative to others.
  return new Map(items.map((item, i) => [item.id, i]))
}

export function HorseRaceChart({ weekDays, weeklyEntries }: HorseRaceChartProps) {
  const { chartData, designers, winnerId, daysWithData, lastDayIndex, labelRanks } = useMemo(() => {
    const designerMap = new Map<string, { name: string; avatarPath: string | null }>()
    for (const day of weekDays) {
      for (const entry of day.entries) {
        if (!designerMap.has(entry.user_id)) {
          designerMap.set(entry.user_id, {
            name: entry.full_name || 'Unknown',
            avatarPath: entry.avatar_path || null,
          })
        }
      }
    }

    const designerIds = Array.from(designerMap.keys())
    const designerList: Designer[] = designerIds.map((id, i) => {
      const d = designerMap.get(id)!
      return {
        id,
        name: d.name,
        color: PALETTE[i % PALETTE.length],
        avatarUrl: getAvatarUrl(d.avatarPath),
      }
    })

    const cumulative: Record<string, number> = {}
    const data: DayPoint[] = []
    let countWithData = 0

    for (const day of weekDays) {
      const dayScores = new Map<string, number>()
      for (const entry of day.entries) {
        if (entry.avg_total_score > 0) {
          dayScores.set(entry.user_id, entry.avg_total_score)
        }
      }

      if (dayScores.size > 0) countWithData++

      const point: DayPoint = { day: day.label }

      for (const id of designerIds) {
        const prev = cumulative[id] || 0
        const dayScore = dayScores.get(id)

        if (dayScore !== undefined) {
          cumulative[id] = prev + dayScore
          point[id] = cumulative[id]
          point[`${id}_daily`] = dayScore
          point[`${id}_carried`] = false
        } else if (prev > 0) {
          point[id] = prev
          point[`${id}_daily`] = 0
          point[`${id}_carried`] = true
        }
      }

      data.push(point)
    }

    const winner = weeklyEntries.length > 0 ? weeklyEntries[0].user_id : null
    const ranks = data.length > 0 ? computeLabelOffsets(designerList, data[data.length - 1]) : new Map()

    return {
      chartData: data,
      designers: designerList,
      winnerId: winner,
      daysWithData: countWithData,
      lastDayIndex: data.length - 1,
      labelRanks: ranks,
    }
  }, [weekDays, weeklyEntries])

  if (daysWithData < 2) {
    return (
      <div className="bg-white rounded-lg border p-4 sm:p-8 flex items-center justify-center h-[200px] text-gray-400 text-sm">
        Race starts after Day 2
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-4 sm:p-8">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Race</h3>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={chartData} margin={{ top: 5, right: 140, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<RaceTooltip designers={designers} />} />
          {designers.map((designer) => {
            const isWinner = designer.id === winnerId
            const rank = labelRanks.get(designer.id) ?? -1
            return (
              <Line
                key={designer.id}
                dataKey={designer.id}
                name={designer.id}
                stroke={isWinner ? GOLD : designer.color}
                strokeWidth={isWinner ? 3 : 1.5}
                dot={
                  <EndLabelDot
                    designer={designer}
                    isWinner={isWinner}
                    lastDayIndex={lastDayIndex}
                    rank={rank}
                    totalDesigners={labelRanks.size}
                    chartData={chartData}
                  />
                }
                activeDot={{ r: 5 }}
                connectNulls={false}
                animationDuration={800}
                animationEasing="ease-out"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Custom dot component that renders avatar+name label on the last data point.
// Uses rank-based positioning to prevent overlap.
function EndLabelDot(props: Record<string, unknown>) {
  const cx = props.cx as number
  const cy = props.cy as number
  const index = props.index as number
  const designer = props.designer as Designer
  const isWinner = props.isWinner as boolean
  const lastDayIndex = props.lastDayIndex as number
  const rank = props.rank as number
  const totalDesigners = props.totalDesigners as number
  const chartData = props.chartData as DayPoint[]

  if (cx == null || cy == null) return null

  const isLast = index === lastDayIndex

  if (!isLast) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isWinner ? 4 : 3}
        fill={isWinner ? GOLD : designer.color}
      />
    )
  }

  // For the last point, compute label Y position based on rank to avoid overlap.
  // Get the Y range from the chart by looking at min/max values in the last data point.
  const lastPoint = chartData[chartData.length - 1]
  let minVal = Infinity
  let maxVal = -Infinity
  for (const key of Object.keys(lastPoint)) {
    if (key === 'day' || key.includes('_daily') || key.includes('_carried')) continue
    const v = lastPoint[key] as number
    if (typeof v === 'number') {
      minVal = Math.min(minVal, v)
      maxVal = Math.max(maxVal, v)
    }
  }

  // The cy for maxVal would be at the top, cy for minVal at the bottom.
  // We need to figure out where to place this label.
  // Simple approach: use rank to spread labels evenly in the vertical space.

  // Calculate the label Y: spread labels evenly from top score's cy to bottom score's cy
  // with minimum LABEL_HEIGHT gap. If the natural spread is enough, use cy directly.
  // Otherwise, compute an even distribution.

  // We know this dot's cy corresponds to its value. We want to check if
  // the natural positions would cause overlap, and if so, redistribute.

  // Since we can't access other dots' cy values here, use the rank + this dot's cy
  // to compute a target position. The rank is 0 for highest score (lowest cy).

  // Target: place label at rank * LABEL_HEIGHT offset from the topmost position.
  // Topmost cy = cy of rank 0 designer. We approximate using this dot's position.

  // Better: use the dot's actual cy but apply a small offset when labels would collide.
  // The offset is: (rank * LABEL_HEIGHT) - (rank / (total-1)) * totalPixelRange
  // But we don't know totalPixelRange...

  // Simplest reliable approach: render label at a fixed slot position relative to
  // the chart area, using rank. We know the chart height is ~490px (500 - margins).
  // Slots start from the top.

  // Actually, the most elegant approach: just render the label at cy, and use
  // a CSS/SVG technique. But in SVG we can't do that easily.

  // Let me use a different strategy: compute the pixel range from min/max values.
  // If the range per designer is < LABEL_HEIGHT, redistribute evenly.

  const valueRange = maxVal - minVal
  const myValue = lastPoint[designer.id] as number
  if (myValue == null) return null

  // Estimate pixels per value unit from cy (this designer's position)
  // cy corresponds to myValue. We need another reference point.
  // Without it, we estimate: if totalDesigners > 1, spread labels
  // at LABEL_HEIGHT intervals centered on the actual value range.

  // Compute the "ideal" Y: evenly spaced from top to bottom based on rank
  const naturalRange = totalDesigners > 1
    ? Math.max((totalDesigners - 1) * LABEL_HEIGHT, 1)
    : 0

  // Center the label band around the midpoint of the value range
  // rank 0 = highest value = should be at top (lowest cy)
  // We need the cy of the median value to anchor. Use this dot's cy as reference.

  // Offset this dot from its natural cy to its slot position:
  // In the natural spread, this dot is at position (maxVal - myValue) / valueRange
  // In the slot spread, it should be at rank / (total - 1)
  const naturalFraction = valueRange > 0 ? (maxVal - myValue) / valueRange : 0
  const slotFraction = totalDesigners > 1 ? rank / (totalDesigners - 1) : 0

  const labelY = cy + (slotFraction - naturalFraction) * naturalRange

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={isWinner ? 4 : 3}
        fill={isWinner ? GOLD : designer.color}
      />
      {/* Connecting line from dot to label if offset */}
      {Math.abs(labelY - cy) > 6 && (
        <line
          x1={cx + 4}
          y1={cy}
          x2={cx + 12}
          y2={labelY}
          stroke="#d1d5db"
          strokeWidth={0.5}
        />
      )}
      <g transform={`translate(${cx + 14}, ${labelY})`}>
        {designer.avatarUrl ? (
          <>
            <defs>
              <clipPath id={`avatar-${designer.id}`}>
                <circle cx={AVATAR_SIZE / 2} cy={0} r={AVATAR_SIZE / 2} />
              </clipPath>
            </defs>
            <image
              href={designer.avatarUrl}
              x={0}
              y={-AVATAR_SIZE / 2}
              width={AVATAR_SIZE}
              height={AVATAR_SIZE}
              clipPath={`url(#avatar-${designer.id})`}
              preserveAspectRatio="xMidYMid slice"
            />
            <circle
              cx={AVATAR_SIZE / 2}
              cy={0}
              r={AVATAR_SIZE / 2}
              fill="none"
              stroke={isWinner ? GOLD : '#d1d5db'}
              strokeWidth={isWinner ? 1.5 : 0.5}
            />
          </>
        ) : (
          <circle
            cx={AVATAR_SIZE / 2}
            cy={0}
            r={AVATAR_SIZE / 2}
            fill="#f3f4f6"
            stroke="#d1d5db"
            strokeWidth={0.5}
          />
        )}
        <text
          x={AVATAR_SIZE + 5}
          y={0}
          dominantBaseline="central"
          fontSize={11}
          fill={isWinner ? GOLD : '#6b7280'}
          fontWeight={isWinner ? 600 : 400}
        >
          {designer.name.split(' ')[0]}
        </text>
      </g>
    </g>
  )
}

function RaceTooltip({ active, payload, label, designers }: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number; payload: DayPoint }>
  label?: string
  designers: Designer[]
}) {
  if (!active || !payload?.length) return null

  const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0))

  return (
    <div className="bg-white border rounded-lg shadow-xl px-5 py-4 text-sm min-w-[300px]">
      <p className="font-semibold text-gray-900 mb-3 text-base">{label}</p>
      <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Designer</span>
        <div className="flex gap-6">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-12 text-right">Week</span>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide w-10 text-right">Day</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {sorted.map((entry) => {
          const designer = designers.find((d) => d.id === entry.dataKey)
          const daily = entry.payload[`${entry.dataKey}_daily`] as number
          const carried = entry.payload[`${entry.dataKey}_carried`] as boolean
          if (!designer || entry.value == null) return null

          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: designer.color }}
                />
                <span className="truncate text-gray-700">{designer.name}</span>
              </div>
              <div className="flex gap-6 shrink-0">
                <span className="font-medium w-12 text-right tabular-nums">
                  {entry.value.toFixed(1)}
                </span>
                <span className="w-10 text-right tabular-nums">
                  {carried ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <span className="text-gray-500">+{daily.toFixed(1)}</span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

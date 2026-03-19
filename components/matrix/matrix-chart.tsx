'use client'

import { useState, useMemo } from 'react'
import { getAvatarUrl } from '@/lib/utils'
import type { LeaderboardEntry } from '@/lib/types/database'
import { RocketIconPaths, DavidIconPaths } from './matrix-icons'

type ScaleMode = 'avg' | 'cumulative'

const CHART = {
  width: 700,
  height: 700,
  padding: { top: 50, right: 50, bottom: 60, left: 60 },
  get plotLeft() { return this.padding.left },
  get plotRight() { return this.width - this.padding.right },
  get plotTop() { return this.padding.top },
  get plotBottom() { return this.height - this.padding.bottom },
  get plotWidth() { return this.plotRight - this.plotLeft },
  get plotHeight() { return this.plotBottom - this.plotTop },
}

const NODE_RADIUS = 20

// Fixed scale for avg mode (1-5)
const AVG_SCALE = { min: 1, max: 5, ticks: [1, 2, 3, 4, 5], snapResolution: 1 }

// Progress ring constants
const RING_RADIUS = NODE_RADIUS + 3
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const TOTAL_SEGMENTS = 5
const GAP_LENGTH = 3
const SEGMENT_LENGTH = RING_CIRCUMFERENCE / TOTAL_SEGMENTS
const ARC_LENGTH = SEGMENT_LENGTH - GAP_LENGTH

type ScaleSpec = { min: number; max: number; ticks: number[]; snapResolution: number }

function computeAutoScale(entries: LeaderboardEntry[]): ScaleSpec {
  if (entries.length === 0) return { min: 0, max: 25, ticks: [0, 5, 10, 15, 20, 25], snapResolution: 2 }

  let maxProd = 0
  let maxQual = 0
  for (const entry of entries) {
    const prod = entry.cumulative_productivity ?? 0
    const qual = entry.cumulative_quality ?? 0
    if (prod > maxProd) maxProd = prod
    if (qual > maxQual) maxQual = qual
  }

  // Use the larger of the two axes so both share the same scale
  const dataMax = Math.max(maxProd, maxQual)
  // Round up to next multiple of 5, add padding
  const scaleMax = Math.max(10, Math.ceil((dataMax + 2) / 5) * 5)

  const ticks: number[] = []
  const step = scaleMax <= 15 ? 3 : 5
  for (let i = 0; i <= scaleMax; i += step) ticks.push(i)
  if (ticks[ticks.length - 1] !== scaleMax) ticks.push(scaleMax)

  return { min: 0, max: scaleMax, ticks, snapResolution: step <= 3 ? 1 : 2 }
}

function scoreToX(value: number, scale: ScaleSpec): number {
  const clamped = Math.max(scale.min, Math.min(scale.max, value))
  return CHART.plotLeft + ((clamped - scale.min) / (scale.max - scale.min)) * CHART.plotWidth
}

function scoreToY(value: number, scale: ScaleSpec): number {
  const clamped = Math.max(scale.min, Math.min(scale.max, value))
  return CHART.plotBottom - ((clamped - scale.min) / (scale.max - scale.min)) * CHART.plotHeight
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

type PositionedNode = {
  entry: LeaderboardEntry & { days_submitted?: number; days_rated?: number }
  prodValue: number
  qualValue: number
  cx: number
  cy: number
}

function computeNodes(entries: LeaderboardEntry[], mode: ScaleMode, scale: ScaleSpec): PositionedNode[] {
  const { snapResolution } = scale

  // Group by snapped position to handle overlaps
  const groups = new Map<string, { entry: LeaderboardEntry; prod: number; qual: number }[]>()
  for (const entry of entries) {
    const prod = mode === 'avg' ? entry.avg_productivity : (entry.cumulative_productivity ?? 0)
    const qual = mode === 'avg' ? entry.avg_quality : (entry.cumulative_quality ?? 0)
    const snappedProd = Math.max(scale.min, Math.min(scale.max, Math.round(prod / snapResolution) * snapResolution))
    const snappedQual = Math.max(scale.min, Math.min(scale.max, Math.round(qual / snapResolution) * snapResolution))
    const key = `${snappedProd},${snappedQual}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push({ entry, prod, qual })
  }

  const positioned: PositionedNode[] = []

  for (const group of groups.values()) {
    if (group.length === 1) {
      const { entry, prod, qual } = group[0]
      positioned.push({
        entry,
        prodValue: prod,
        qualValue: qual,
        cx: scoreToX(prod, scale),
        cy: scoreToY(qual, scale),
      })
      continue
    }

    // Use the group centroid for the center position
    const avgProd = group.reduce((s, g) => s + g.prod, 0) / group.length
    const avgQual = group.reduce((s, g) => s + g.qual, 0) / group.length
    const centerX = scoreToX(avgProd, scale)
    const centerY = scoreToY(avgQual, scale)

    const spreadRadius = group.length <= 3 ? 28 : group.length <= 6 ? 36 : 44
    const angleStep = (2 * Math.PI) / group.length
    const startAngle = -Math.PI / 2

    for (let i = 0; i < group.length; i++) {
      const angle = startAngle + i * angleStep
      positioned.push({
        entry: group[i].entry,
        prodValue: group[i].prod,
        qualValue: group[i].qual,
        cx: centerX + Math.cos(angle) * spreadRadius,
        cy: centerY + Math.sin(angle) * spreadRadius,
      })
    }
  }

  return positioned
}

interface WeekDay {
  date: string
  label: string
  entries: LeaderboardEntry[]
}

interface MatrixChartProps {
  entries: LeaderboardEntry[]
  mode?: ScaleMode
  weekDays?: WeekDay[]
}

export function MatrixChart({ entries, mode = 'avg', weekDays }: MatrixChartProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // For cumulative mode, compute cumulative productivity/quality + rated days from day data
  const enrichedEntries = useMemo(() => {
    if (mode !== 'cumulative' || !weekDays) return entries

    // Sum each designer's daily scores and count rated days across weekDays
    const cumulativeMap = new Map<string, { prod: number; qual: number; daysSubmitted: number; daysRated: number }>()
    for (const day of weekDays) {
      for (const entry of day.entries) {
        const existing = cumulativeMap.get(entry.user_id) || { prod: 0, qual: 0, daysSubmitted: 0, daysRated: 0 }
        existing.daysSubmitted += 1
        // Only count rated days (avg_total_score > 0 means at least one rating exists; scale is 1-5 so rated = non-zero)
        if (entry.avg_total_score > 0) {
          existing.prod += entry.avg_productivity
          existing.qual += entry.avg_quality
          existing.daysRated += 1
        }
        cumulativeMap.set(entry.user_id, existing)
      }
    }

    return entries.map((entry) => {
      const cumulative = cumulativeMap.get(entry.user_id)
      return {
        ...entry,
        cumulative_productivity: cumulative?.prod ?? 0,
        cumulative_quality: cumulative?.qual ?? 0,
        days_submitted: cumulative?.daysSubmitted ?? 0,
        days_rated: cumulative?.daysRated ?? 0,
      }
    })
  }, [entries, mode, weekDays])

  // Compute scale: fixed for avg, auto for cumulative
  const scale = useMemo<ScaleSpec>(() => {
    if (mode === 'avg') return AVG_SCALE
    return computeAutoScale(enrichedEntries)
  }, [mode, enrichedEntries])

  const nodes = useMemo(() => computeNodes(enrichedEntries, mode, scale), [enrichedEntries, mode, scale])

  const hoveredNode = nodes.find((n) => n.entry.user_id === hoveredId)

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No data available for this time period.</p>
        <p className="text-sm mt-1">Submissions with ratings will appear here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-2 sm:p-4">
      <div className="relative w-full mx-auto">
        <svg
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          className="w-full h-auto"
          role="img"
          aria-label="Performance matrix chart plotting designers by productivity and quality"
        >
          {/* Grid lines */}
          {scale.ticks.map((tick) => (
            <g key={`grid-${tick}`}>
              <line
                x1={scoreToX(tick, scale)}
                y1={CHART.plotTop}
                x2={scoreToX(tick, scale)}
                y2={CHART.plotBottom}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={CHART.plotLeft}
                y1={scoreToY(tick, scale)}
                x2={CHART.plotRight}
                y2={scoreToY(tick, scale)}
                stroke="#e5e7eb"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* Axis border lines (bold, at origin) */}
          <line
            x1={CHART.plotLeft}
            y1={CHART.plotTop}
            x2={CHART.plotLeft}
            y2={CHART.plotBottom}
            stroke="#d1d5db"
            strokeWidth="1.5"
          />
          <line
            x1={CHART.plotLeft}
            y1={CHART.plotBottom}
            x2={CHART.plotRight}
            y2={CHART.plotBottom}
            stroke="#d1d5db"
            strokeWidth="1.5"
          />

          {/* Axis tick labels */}
          {scale.ticks.map((tick) => (
            <g key={`labels-${tick}`}>
              <text
                x={scoreToX(tick, scale)}
                y={CHART.plotBottom + 20}
                textAnchor="middle"
                fill="#9ca3af"
                style={{ fontSize: 12 }}
              >
                {tick}
              </text>
              <text
                x={CHART.plotLeft - 12}
                y={scoreToY(tick, scale)}
                textAnchor="end"
                dominantBaseline="central"
                fill="#9ca3af"
                style={{ fontSize: 12 }}
              >
                {tick}
              </text>
            </g>
          ))}

          {/* Axis title labels */}
          <text
            x={(CHART.plotLeft + CHART.plotRight) / 2}
            y={CHART.plotBottom + 46}
            textAnchor="middle"
            fill="#6b7280"
            style={{ fontSize: 13, fontWeight: 500 }}
          >
            Productivity{mode === 'cumulative' ? ' (cumulative)' : ''}
          </text>
          <text
            x={CHART.plotLeft - 40}
            y={(CHART.plotTop + CHART.plotBottom) / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#6b7280"
            style={{ fontSize: 13, fontWeight: 500 }}
            transform={`rotate(-90, ${CHART.plotLeft - 40}, ${(CHART.plotTop + CHART.plotBottom) / 2})`}
          >
            Quality{mode === 'cumulative' ? ' (cumulative)' : ''}
          </text>

          {/* Decorative icons */}
          <g
            transform={`translate(${CHART.plotRight + 4}, ${CHART.plotBottom - 42}) scale(0.75)`}
            style={{ color: '#d1d5db' }}
          >
            <RocketIconPaths />
          </g>
          <g
            transform={`translate(${CHART.plotLeft - 8}, ${CHART.plotTop - 44}) scale(0.65)`}
            style={{ color: '#d1d5db' }}
          >
            <DavidIconPaths />
          </g>

          {/* Clip path definitions */}
          <defs>
            {nodes.map(({ entry }) => (
              <clipPath key={`clip-${entry.user_id}`} id={`clip-${entry.user_id}`}>
                <circle r={NODE_RADIUS - 1.5} />
              </clipPath>
            ))}
          </defs>

          {/* Designer nodes */}
          {nodes.map(({ entry, cx, cy }) => {
            const isHovered = hoveredId === entry.user_id
            const avatarUrl = getAvatarUrl(entry.avatar_path)
            const enriched = entry as LeaderboardEntry & { days_rated?: number }
            const daysRated = enriched.days_rated ?? 0
            const showRing = mode === 'cumulative'

            return (
              <g
                key={entry.user_id}
                style={{
                  transform: `translate(${cx}px, ${cy}px) scale(${isHovered ? 1.3 : 1})`,
                  transformOrigin: '0 0',
                  transition: 'transform 150ms ease-out, filter 150ms ease-out',
                  filter: isHovered
                    ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.18))'
                    : 'drop-shadow(0 1px 3px rgba(0,0,0,0.08))',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredId(entry.user_id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() =>
                  setHoveredId((prev) => (prev === entry.user_id ? null : entry.user_id))
                }
              >
                {/* Segmented progress ring (cumulative mode only) */}
                {showRing && Array.from({ length: TOTAL_SEGMENTS }).map((_, i) => (
                  <circle
                    key={`ring-${i}`}
                    r={RING_RADIUS}
                    cx={0}
                    cy={0}
                    fill="none"
                    stroke={i < daysRated ? '#f59e0b' : '#e5e7eb'}
                    strokeWidth={3}
                    strokeDasharray={`${ARC_LENGTH} ${RING_CIRCUMFERENCE - ARC_LENGTH}`}
                    strokeDashoffset={-(i * SEGMENT_LENGTH) + RING_CIRCUMFERENCE / 4}
                    strokeLinecap="round"
                  />
                ))}

                <circle
                  r={NODE_RADIUS}
                  cx={0}
                  cy={0}
                  fill="white"
                  stroke={isHovered ? '#9ca3af' : '#e5e7eb'}
                  strokeWidth={isHovered ? 2 : 1.5}
                />

                {avatarUrl ? (
                  <image
                    href={avatarUrl}
                    x={-(NODE_RADIUS - 1.5)}
                    y={-(NODE_RADIUS - 1.5)}
                    width={(NODE_RADIUS - 1.5) * 2}
                    height={(NODE_RADIUS - 1.5) * 2}
                    clipPath={`url(#clip-${entry.user_id})`}
                    preserveAspectRatio="xMidYMid slice"
                  />
                ) : (
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#6b7280"
                    style={{ fontSize: 11, fontWeight: 500, pointerEvents: 'none' }}
                  >
                    {getInitials(entry.full_name)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* HTML tooltip overlay */}
        {hoveredNode && (
          <div
            className="absolute pointer-events-none z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 transition-opacity duration-150"
            style={{
              left: `${(hoveredNode.cx / CHART.width) * 100}%`,
              top: `${(hoveredNode.cy / CHART.height) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 28px))',
            }}
          >
            <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">
              {hoveredNode.entry.full_name || 'Unknown'}
            </p>
            <div className="flex gap-3 mt-0.5 text-gray-500 text-xs whitespace-nowrap">
              <span>Productivity: {hoveredNode.prodValue.toFixed(1)}</span>
              <span>Quality: {hoveredNode.qualValue.toFixed(1)}</span>
              {mode === 'cumulative' && (
                <span>Days: {(hoveredNode.entry as LeaderboardEntry & { days_rated?: number }).days_rated ?? 0}/5</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

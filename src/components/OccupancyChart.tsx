'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { HistoryPoint, TypicalHour } from '@/lib/types'

interface Props {
  locationId: string
}

type RecentChartPoint = HistoryPoint & {
  sortKey: number
  axisLabel: string
  tooltipLabel: string
  busyness: number
}

type TypicalChartPoint = {
  hour: number
  label: string
  busyness: number
  hasData: boolean
}

function formatHourLabel(hour: number) {
  if (hour === 0) return '12 AM'
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return '12 PM'
  return `${hour - 12} PM`
}

function parseDateLike(value: unknown): Date | null {
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw) return null

  if (/^\d+$/.test(raw)) {
    const numericDate = new Date(Number(raw))
    if (!Number.isNaN(numericDate.getTime())) return numericDate
  }

  const normalized =
    raw.includes(' ') && !raw.includes('T') ? raw.replace(' ', 'T') : raw

  const parsed = new Date(normalized)
  if (!Number.isNaN(parsed.getTime())) return parsed

  return null
}

function TypicalTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value?: number; payload?: TypicalChartPoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="min-w-[180px] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <div className="text-sm font-semibold text-zinc-100">{label}</div>
      <div className="mt-1 text-sm text-zinc-300">
        {point.hasData ? (
          <>
            Typical busyness:{' '}
            <span className="font-medium text-gold-400">{point.busyness}%</span>
          </>
        ) : (
          <span className="text-zinc-400">No data yet</span>
        )}
      </div>
    </div>
  )
}

function RecentTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: RecentChartPoint; value?: number }>
}) {
  if (!active || !payload?.length) return null

  const point = payload[0]?.payload
  if (!point) return null

  return (
    <div className="min-w-[200px] rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <div className="text-sm font-semibold text-zinc-100">{point.tooltipLabel}</div>
      <div className="mt-1 text-sm text-zinc-300">
        Busyness:{' '}
        <span className="font-medium text-gold-400">{point.busyness}%</span>
      </div>
    </div>
  )
}

export function OccupancyChart({ locationId }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [typical, setTypical] = useState<TypicalHour[]>([])
  const [tab, setTab] = useState<'recent' | 'typical'>('recent')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)

    Promise.all([
      fetch(`/api/history/${locationId}?mode=recent`).then((r) => r.json()),
      fetch(`/api/history/${locationId}?mode=typical`).then((r) => r.json()),
    ])
      .then(([recentData, typicalData]) => {
        setHistory(recentData.history || [])
        setTypical(typicalData.typical || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [locationId])

  const recentChartData = useMemo<RecentChartPoint[]>(() => {
    return history
      .map((point, index) => {
        const parsedDate = parseDateLike(point.time) ?? parseDateLike(point.hour)

        return {
          ...point,
          sortKey: parsedDate ? parsedDate.getTime() : index,
          axisLabel: parsedDate
            ? parsedDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'America/Toronto',
              })
            : point.time || point.hour || `Point ${index + 1}`,
          tooltipLabel: parsedDate
            ? parsedDate.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'America/Toronto',
              })
            : point.time || point.hour || 'Unknown time',
          busyness: Number.isFinite(point.busyness) ? point.busyness : 0,
        }
      })
      .sort((a, b) => a.sortKey - b.sortKey)
  }, [history])

  const typicalChartData = useMemo<TypicalChartPoint[]>(() => {
    return typical
      .filter((h) => h.hour >= 7 && h.hour <= 23)
      .map((h) => ({
        hour: h.hour,
        label: formatHourLabel(h.hour),
        busyness: h.busyness ?? 0,
        hasData: h.busyness !== null,
      }))
  }, [typical])

  const barColor = (busyness: number) =>
    busyness < 40 ? '#34d399' : busyness < 70 ? '#facc15' : '#f87171'

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-600">
        Loading chart data…
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(['recent', 'typical'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1 text-sm transition-all ${
              tab === t
                ? 'bg-gold-500 font-semibold text-zinc-900'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t === 'recent' ? 'Last 7 days' : 'Typical day'}
          </button>
        ))}
      </div>

      {tab === 'recent' ? (
        recentChartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">
            Not enough data yet — check back after a few hours.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={recentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="axisLabel"
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#a1a1aa', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={<RecentTooltip />}
                cursor={{ stroke: '#52525b', strokeDasharray: '4 4' }}
              />
              <Line
                type="monotone"
                dataKey="busyness"
                stroke="#FED141"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )
      ) : typicalChartData.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-600">
          Need more historical data to show typical patterns.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={typicalChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              interval={1}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={<TypicalTooltip />}
              cursor={{ fill: 'rgba(250, 204, 21, 0.08)' }}
            />
            <Bar dataKey="busyness" radius={[4, 4, 0, 0]} maxBarSize={36}>
              {typicalChartData.map((entry) => (
                <Cell
                  key={entry.hour}
                  fill={entry.hasData ? barColor(entry.busyness) : '#3f3f46'}
                  opacity={entry.hasData ? 1 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
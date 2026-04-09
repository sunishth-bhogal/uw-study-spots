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

  const recentChartData = useMemo(() => {
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

  const typicalChartData = useMemo(() => {
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
      <div className="h-48 flex items-center justify-center text-zinc-600 text-sm">
        Loading chart data…
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(['recent', 'typical'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-lg text-sm transition-all ${
              tab === t
                ? 'bg-gold-500 text-zinc-900 font-semibold'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t === 'recent' ? 'Last 7 days' : 'Typical day'}
          </button>
        ))}
      </div>

      {tab === 'recent' ? (
        recentChartData.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-8">
            Not enough data yet — check back after a few hours.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={recentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
              <XAxis
                dataKey="axisLabel"
                tick={{ fill: '#71717a', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#71717a', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: '#18181b',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                }}
                labelStyle={{ color: '#d4d4d8' }}
                labelFormatter={(_label, payload) => {
                  const point = payload?.[0]?.payload
                  return point?.tooltipLabel ?? ''
                }}
                formatter={(v: number) => [`${v}%`, 'Busyness']}
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
        <p className="text-zinc-600 text-sm text-center py-8">
          Need more historical data to show typical patterns.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={typicalChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
            <XAxis
              dataKey="label"
              tick={{ fill: '#71717a', fontSize: 11 }}
              interval={1}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid #3f3f46',
                borderRadius: 8,
              }}
              labelStyle={{ color: '#d4d4d8' }}
              formatter={(v: number, _name, props) => {
                return props.payload?.hasData
                  ? [`${v}%`, 'Typical busyness']
                  : ['No data', 'Typical busyness']
              }}
            />
            <Bar dataKey="busyness" radius={[4, 4, 0, 0]}>
              {typicalChartData.map((entry) => (
                <Cell
                  key={entry.hour}
                  fill={entry.hasData ? barColor(entry.busyness) : '#3f3f46'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
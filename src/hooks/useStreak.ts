'use client'
import { useCallback, useEffect, useState } from 'react'

interface StreakData {
  current: number
  longest: number
  lastReportDate: string | null // YYYY-MM-DD local time
}

const STORAGE_KEY = 'uw-study-streak'

function todayStr() {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA')
}

function readStored(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { current: 0, longest: 0, lastReportDate: null }
}

function writeStored(data: StreakData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export function useStreak() {
  const [streak, setStreak] = useState<StreakData>({ current: 0, longest: 0, lastReportDate: null })

  useEffect(() => {
    setStreak(readStored())

    // Listen for updates fired by VibeCheck/SeatReport in the same tab
    const onUpdate = () => setStreak(readStored())
    window.addEventListener('streak-updated', onUpdate)
    return () => window.removeEventListener('streak-updated', onUpdate)
  }, [])

  const recordReport = useCallback(() => {
    const today = todayStr()
    const yesterday = yesterdayStr()

    setStreak((prev) => {
      // Already reported today — no change
      if (prev.lastReportDate === today) return prev

      const newCurrent =
        prev.lastReportDate === yesterday
          ? prev.current + 1  // consecutive day
          : 1                 // first ever or gap — reset

      const next: StreakData = {
        current: newCurrent,
        longest: Math.max(newCurrent, prev.longest),
        lastReportDate: today,
      }

      writeStored(next)
      window.dispatchEvent(new Event('streak-updated'))
      return next
    })
  }, [])

  return { streak, recordReport }
}
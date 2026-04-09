'use client'
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'uw-study-spots-favourites'

export function useFavorites() {
  const [favourites, setFavourites] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setFavourites(new Set(JSON.parse(stored)))
    } catch {}
    setLoaded(true)
  }, [])

  const toggle = useCallback((locationId: string) => {
    setFavourites((prev) => {
      const next = new Set(prev)
      if (next.has(locationId)) {
        next.delete(locationId)
      } else {
        next.add(locationId)
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [])

  const isFavourite = useCallback(
    (locationId: string) => favourites.has(locationId),
    [favourites]
  )

  return { favourites, toggle, isFavourite, loaded }
}
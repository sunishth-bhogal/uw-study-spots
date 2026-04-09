import { Location } from './types'

const CAMPUS = process.env.WAITZ_CAMPUS || 'waterloo'
const WAITZ_API = `https://waitz.io/live/${CAMPUS}`

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function fetchWaitzData(): Promise<Location[]> {
  const res = await fetch(WAITZ_API, {
    next: { revalidate: 0 },
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; UWStudySpots/1.0)',
    },
  })

  if (!res.ok) {
    throw new Error(`Waitz API error: ${res.status}`)
  }

  const json = await res.json()
  const locations = json.data ?? []

  return locations.map((loc: any): Location => {
    const inferredOpen =
      (loc.people ?? 0) > 0 ||
      (loc.busyness ?? 0) > 0 ||
      Boolean(loc.isOpen ?? loc.isAvailable)

    return {
      id: slugify(loc.name),
      name: loc.name,
      busyness: Math.round(loc.busyness ?? 0),
      count: loc.people ?? 0,
      capacity: loc.capacity ?? 0,
      isOpen: inferredOpen,
      lastUpdated: new Date().toISOString(),
      subLocations: (loc.subLocs || [])
        .filter((sub: any) => sub.name)
        .map((sub: any) => ({
          name: sub.name,
          busyness: Math.round(sub.busyness ?? 0),
          count: sub.people ?? 0,
          capacity: sub.capacity ?? 0,
        })),
    }
  })
}

export function busynessColor(busyness: number): string {
  if (busyness < 40) return 'green'
  if (busyness < 70) return 'yellow'
  return 'red'
}

export function busynessLabel(busyness: number): string {
  if (busyness < 25) return 'Very quiet'
  if (busyness < 50) return 'Fairly quiet'
  if (busyness < 70) return 'Getting busy'
  if (busyness < 85) return 'Very busy'
  return 'Packed'
}
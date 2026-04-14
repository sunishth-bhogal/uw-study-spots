'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'

type MapLocation = {
  id: string
  name: string
  busyness?: number
  isOpen?: boolean
  latitude?: number | null
  longitude?: number | null
  buildingCode?: string | null
  building_code?: string | null
  source?: 'waitz' | 'community' | 'building'
  dataSource?: 'waitz' | 'community' | 'building'
  count?: number
  capacity?: number
  currentOccupancy?: number
  current_occupancy?: number
  reportCount?: number
  report_count?: number
}

type Props = {
  locations: MapLocation[]
}

const CAMPUS_CENTER: [number, number] = [43.471, -80.543]
const CAMPUS_BOUNDS: LatLngBoundsExpression = [
  [43.4568, -80.5665],
  [43.4792, -80.5285],
]

function SyncMapView({ locations }: { locations: MapLocation[] }) {
  const map = useMap()

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()

      const validPoints = locations.filter(
        (loc) => typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
      )

      if (validPoints.length === 0) {
        map.setView(CAMPUS_CENTER, 16)
        return
      }

      if (validPoints.length === 1) {
        map.setView(
          [validPoints[0].latitude as number, validPoints[0].longitude as number],
          17
        )
        return
      }

      const bounds = validPoints.map(
        (loc) => [loc.latitude as number, loc.longitude as number] as [number, number]
      )

      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 17,
      })
    }, 100)

    return () => clearTimeout(timer)
  }, [map, locations])

  return null
}

function getBuildingCode(loc: MapLocation) {
  return loc.buildingCode?.trim().toUpperCase() || loc.building_code?.trim().toUpperCase() || null
}

function getCurrentOccupancy(loc: MapLocation) {
  const value = Number(loc.currentOccupancy ?? loc.current_occupancy ?? loc.count ?? 0)
  return Number.isFinite(value) ? value : 0
}

function getCapacity(loc: MapLocation) {
  const value = Number(loc.capacity ?? 0)
  return Number.isFinite(value) ? value : 0
}

function getReportCount(loc: MapLocation) {
  const value = Number(loc.reportCount ?? loc.report_count ?? 0)
  return Number.isFinite(value) ? value : 0
}

function hasLiveData(loc: MapLocation) {
  return getCapacity(loc) > 0
}

function getSource(loc: MapLocation) {
  return loc.dataSource ?? loc.source ?? 'building'
}

function isSubspaceName(name: string) {
  const normalized = name.toLowerCase()
  return (
    normalized.includes('cafeteria') ||
    normalized.includes('coffee') ||
    normalized.includes('donut') ||
    normalized.includes('lounge') ||
    normalized.includes('cube') ||
    normalized.includes('deck') ||
    normalized.includes('centre, needles') ||
    normalized.includes('study deck') ||
    normalized.includes('project cube')
  )
}

function getDisplayName(loc: MapLocation) {
  if (loc.id === 'davis-centre-cafeteria') return 'Davis Library'
  return loc.name
}

function getMarkerPriority(loc: MapLocation) {
  let score = 0

  if (hasLiveData(loc)) score += 100
  if (getSource(loc) === 'waitz') score += 60
  if (getReportCount(loc) > 0) score += 20
  if (!loc.id.startsWith('building-')) score += 10
  if (isSubspaceName(loc.name)) score -= 50

  return score
}

function dedupeLocations(locations: MapLocation[]) {
  const valid = locations.filter(
    (loc) => typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
  )

  const bestByKey = new Map<string, MapLocation>()

  for (const loc of valid) {
    const code = getBuildingCode(loc)
    const key = code ?? `${loc.latitude!.toFixed(5)}:${loc.longitude!.toFixed(5)}`

    const existing = bestByKey.get(key)

    if (!existing || getMarkerPriority(loc) > getMarkerPriority(existing)) {
      bestByKey.set(key, loc)
    }
  }

  return Array.from(bestByKey.values())
}

function getStatusLabel(loc: MapLocation) {
  if (hasLiveData(loc) && typeof loc.isOpen === 'boolean') {
    return loc.isOpen ? 'Open now' : 'Closed now'
  }

  if (getReportCount(loc) > 0) {
    return 'Student reported'
  }

  return 'Hours unverified'
}

function getBusynessLabel(loc: MapLocation) {
  const hasData = hasLiveData(loc) || getReportCount(loc) > 0

  if (!hasData) {
    return 'No recent busyness data'
  }

  const busyness = Number(loc.busyness)
  if (!Number.isFinite(busyness)) {
    return 'No recent busyness data'
  }

  return `${Math.round(busyness)}% busy`
}

function getMarkerColor(loc: MapLocation) {
  const hasData = hasLiveData(loc) || getReportCount(loc) > 0
  if (!hasData) return '#71717a'

  const busyness = Number(loc.busyness)
  if (!Number.isFinite(busyness)) return '#71717a'
  if (busyness < 40) return '#34d399'
  if (busyness < 70) return '#facc15'
  return '#f87171'
}

export default function CampusMap({ locations }: Props) {
  const [mounted, setMounted] = useState(false)

  const mapLocations = useMemo(() => dedupeLocations(locations), [locations])

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="relative z-0 space-y-3">
        <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 sm:h-[520px]" />
      </div>
    )
  }

  return (
    <div className="relative z-0 space-y-3">
      <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-white/10 sm:h-[520px]">
        <MapContainer
          key="campus-map"
          center={CAMPUS_CENTER}
          zoom={16}
          minZoom={15}
          maxZoom={19}
          maxBounds={CAMPUS_BOUNDS}
          maxBoundsViscosity={1.0}
          zoomSnap={0.25}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <SyncMapView locations={mapLocations} />

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          {mapLocations.map((loc) => (
            <CircleMarker
              key={getBuildingCode(loc) ?? loc.id}
              center={[loc.latitude as number, loc.longitude as number]}
              radius={8}
              pathOptions={{
                color: getMarkerColor(loc),
                fillColor: getMarkerColor(loc),
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold">{getDisplayName(loc)}</div>
                  <div>{getStatusLabel(loc)}</div>
                  <div>{getBusynessLabel(loc)}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
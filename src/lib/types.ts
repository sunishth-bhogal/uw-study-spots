// Raw response from the Waitz API
export interface WaitzSubLocation {
  name: string
  busyness: number
  count: number
  capacity: number
  isOpen: boolean
}

export interface WaitzLocation {
  name: string
  id: string
  busyness: number
  count: number
  capacity: number
  isOpen: boolean
  subLocs?: WaitzSubLocation[]
}

export interface WaitzResponse {
  data: WaitzLocation[]
}

export type LocationSource = 'waitz' | 'community' | 'building'
export type CommunityConfidence = 'none' | 'low' | 'medium' | 'high'

export interface SubLocation {
  name: string
  busyness: number
  count: number
  capacity: number
  isOpen?: boolean
}

export interface Location {
  id: string
  name: string
  busyness: number
  count: number
  capacity: number
  isOpen: boolean
  subLocations: SubLocation[]
  lastUpdated: string

  // normalized extra fields used by the app
  source?: LocationSource
  dataSource?: LocationSource
  waitzName?: string | null
  waitz_name?: string | null

  reportCount?: number
  report_count?: number
  lastReportedAt?: string | null
  last_reported_at?: string | null
  confidence?: CommunityConfidence

  buildingCode?: string | null
  building_code?: string | null
  category?: string | null
  description?: string | null

  latitude?: number | null
  longitude?: number | null

  currentOccupancy?: number
  current_occupancy?: number

  is_active?: boolean
}

export interface OccupancyReading {
  id: string
  location_id: string
  location_name: string
  busyness: number
  count: number
  capacity: number
  is_open: boolean
  recorded_at: string
}

export type VibeOption = 'less_packed' | 'accurate' | 'more_packed'

export interface VibeCheck {
  id: string
  location_id: string
  vibe: VibeOption
  submitted_at: string
}

export interface SeatReport {
  id: string
  location_id: string
  seats_available: number
  submitted_at: string
}

export interface VibeSummary {
  less_packed: number
  accurate: number
  more_packed: number
  total: number
}

export interface HistoryPoint {
  time: string
  hour: string
  busyness: number
}

export interface TypicalHour {
  hour: number
  busyness: number | null
  label?: string
}

export interface CommunityReport {
  id: string
  location_id: string
  crowdedness: number | null
  seats_available: number | null
  quietness: number | null
  has_outlets: boolean | null
  has_food_nearby: boolean | null
  is_open: boolean | null
  floor_label: string | null
  note: string | null
  submitted_at: string
}

export interface CommunityReportInput {
  locationId: string
  crowdedness: number | null
  seatsAvailable: number | null
  quietness: number | null
  hasOutlets: boolean | null
  hasFoodNearby: boolean | null
  isOpen: boolean | null
  floorLabel?: string
  note?: string
}

export interface CommunityReportSummary {
  avg_crowdedness: number | null
  avg_seats_available: number | null
  avg_quietness: number | null
  any_open_report: boolean
  report_count: number
  last_reported_at: string | null
}
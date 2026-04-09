const EXCLUDED_BUILDING_CODES = new Set([
    'CLV',
    'CLN',
    'CMH',
    'MHR',
    'MKV',
    'REV',
    'TH',
    'UWP',
    'V1',
  ])
  
  type FilterableLocation = {
    building_code?: string | null
    name?: string | null
  }
  
  export function shouldExcludeLocation(location: FilterableLocation) {
    const code = location.building_code?.trim().toUpperCase()
    if (!code) return false
    return EXCLUDED_BUILDING_CODES.has(code)
  }
  
  export function filterStudyLocations<T extends FilterableLocation>(locations: T[]) {
    return locations.filter((location) => !shouldExcludeLocation(location))
  }
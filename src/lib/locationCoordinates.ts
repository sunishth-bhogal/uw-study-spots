import { ST } from "next/dist/shared/lib/utils"

type Coordinates = {
    latitude: number
    longitude: number
  }
  
  export const BUILDING_COORDINATES: Record<string, Coordinates> = {
    LIB: { latitude: 43.469694, longitude: -80.542298 },
    DC: { latitude: 43.472434, longitude: -80.542005 },
  
    EV1: { latitude: 43.468361, longitude: -80.542342 },
    EV2: { latitude: 43.468263, longitude: -80.542704 },
    EV3: { latitude: 43.467996, longitude: -80.543254 },
  
    MC: { latitude: 43.472121, longitude: -80.543933 },
    M3: { latitude: 43.473189, longitude: -80.544075 },
  
    ESC: { latitude: 43.471371, longitude: -80.542753 },
    SLC: { latitude: 43.471617, longitude: -80.545281 },
    STC: { latitude: 43.470568, longitude: -80.543466 },
  
    CPH: { latitude: 43.470942, longitude: -80.539248 },
    DWE: { latitude: 43.470081, longitude: -80.539708 },
  
    E2: { latitude: 43.470822, longitude: -80.540483 },
    E3: { latitude: 43.470807, longitude: -80.543704 },
    E5: { latitude: 43.472862, longitude: -80.540058 },
    E6: { latitude: 43.473006, longitude: -80.538707 },
    RCH: { latitude: 43.47028, longitude: -80.540718 },
  
    QNC: { latitude: 43.47136, longitude: -80.544322 },
    PHY: { latitude: 43.470849, longitude: -80.541556 },
  
    B1: { latitude: 43.470816, longitude: -80.543716 },
    B2: { latitude: 43.470807, longitude: -80.543704 },
    C2:{ latitude: 43.47206, longitude: -80.543004 },
  
    PAS: { latitude: 43.467152, longitude: -80.542283 },
    HH: { latitude: 43.468036, longitude: -80.54174 },
    AL: { latitude: 43.468891, longitude: -80.541783 },
    ML: { latitude: 43.468931, longitude: -80.542738 },

    HLTH: { latitude: 43.473564, longitude: -80.54625 },
  
    OPT: { latitude: 43.475882, longitude: -80.545504 },

    RUC: { latitude: 43.469004, longitude: -80.54726 },
    UTD: { latitude: 43.468704, longitude: -80.545892 }

  }
  
  export const BUILDING_NAMES: Record<string, string> = {
    LIB: 'Dana Porter Library',
    DC: 'William G. Davis Computer Research Centre',
  
    EV1: 'Environment 1',
    EV2: 'Environment 2',
    EV3: 'Environment 3',
  
    MC: 'Mathematics & Computer Building',
    M3: 'Mathematics 3',
  
    ESC: 'Earth Sciences & Chemistry',
    SLC: 'Student Life Centre',
    STC: 'Science Teaching Complex',
  
    CPH: 'Carl A. Pollock Hall',
    DWE: 'Douglas Wright Engineering Building',
  
    E2: 'Engineering 2',
    E3: 'Engineering 3',
    E5: 'Engineering 5',
    E6: 'Engineering 6',
    RCH: 'J.R. Coutts Engineering Lecture Hall',
  
    QNC: 'Mike & Ophelia Lazaridis Quantum-Nano Centre',
    PHY: 'Physics',
  
    B1: 'Biology 1',
    B2: 'Biology 2',
    C2: 'Chemistry 2',
  
    PAS: 'Psychology, Anthropology, Sociology',
    HH: 'J.G. Hagey Hall',
    AL: 'Arts Lecture Hall',
    ML: 'Modern Languages, Theatre of the Arts',
  
    OPT: 'School of Optometry and Vision Science',

    HLTH: "Applied Health Sciences Expansion Building",

    RUC: "Lusi Wong Library",
    UTD: "St. Jerome's Library"
  }
  
  export function getLocationCoordinates(
    _name: string | null | undefined,
    buildingCode: string | null | undefined
  ): { latitude: number | null; longitude: number | null } {
    const normalizedCode = buildingCode?.trim().toUpperCase()
  
    if (normalizedCode && BUILDING_COORDINATES[normalizedCode]) {
      return BUILDING_COORDINATES[normalizedCode]
    }
  
    return {
      latitude: null,
      longitude: null,
    }
  }
  
  export function getBuildingDisplayName(
    buildingCode: string | null | undefined,
    fallbackName: string
  ) {
    const normalizedCode = buildingCode?.trim().toUpperCase()
  
    if (normalizedCode && BUILDING_NAMES[normalizedCode]) {
      return BUILDING_NAMES[normalizedCode]
    }
  
    return fallbackName
  }
  
  export function hasSupportedBuildingCode(buildingCode: string | null | undefined) {
    const normalizedCode = buildingCode?.trim().toUpperCase()
    return Boolean(normalizedCode && BUILDING_COORDINATES[normalizedCode])
  }
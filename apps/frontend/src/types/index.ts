// GeoJSON primitives
export interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number] // [lng, lat]
}

export interface GeoJSONLineString {
  type: 'LineString'
  coordinates: [number, number][]
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: [number, number][][]
}

export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon

export interface GeoJSONFeature<G extends GeoJSONGeometry = GeoJSONGeometry, P = Record<string, unknown>> {
  type: 'Feature'
  geometry: G
  properties: P
}

export interface GeoJSONFeatureCollection<G extends GeoJSONGeometry = GeoJSONGeometry> {
  type: 'FeatureCollection'
  features: GeoJSONFeature<G>[]
}

// Domain types
export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'viewer'
  createdAt: string
}

export interface Vineyard {
  id: string
  name: string
  description?: string
  boundary?: GeoJSONPolygon
  ownerId?: string
  createdAt: string
}

export type RowStatus = 'proposed' | 'confirmed'

export interface Row {
  id: string
  vineyardId: string
  rowNumber: number
  line?: GeoJSONLineString
  variety?: string
  status: RowStatus
  createdAt: string
}

export interface Vine {
  id: string
  rowId: string
  vineNumber: number
  position?: GeoJSONPoint
  notes?: string
  createdAt: string
}

export type GrapeColor = 'weiss' | 'rot' | 'rose'

export interface GrapeVariety {
  id: string
  name: string
  color: GrapeColor
  createdBy: string
  createdAt: string
}

export interface Harvest {
  id: string
  vineyardId: string
  varietyId: string
  variety?: GrapeVariety
  harvestDate: string
  weightKg: number
  oechsle?: number
  notes?: string
  createdBy: string
  createdAt: string
}

export type TaskStatus = 'offen' | 'in_bearbeitung' | 'erledigt'
export type RecordType = 'aufgabe' | 'beobachtung'
export type TaskCategory = 'pflanzenschutz' | 'rebenpflege' | 'infrastruktur' | 'boden' | 'phaenologie' | 'sonstiges'
export type Severity = 'niedrig' | 'mittel' | 'hoch'

export interface Task {
  id: string
  vineId?: string
  vineyardId?: string
  title: string
  recordType: RecordType
  category: TaskCategory
  severity?: Severity
  phase?: string
  status: TaskStatus
  notes?: string
  location?: GeoJSONPoint
  assignedTo?: string
  dueDate?: string
  completedAt?: string
  createdBy?: string
  createdAt: string
}

// Auth
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  name: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}

// Weather
export interface WeatherData {
  stationId: number
  stationName: string
  tempC: number
  humidityPct: number
  precipMm: number
  leafWetH: number
  fetchedAt: string
}

export type ProtectionLevel = 'grün' | 'gelb' | 'rot'

export interface PlantProtectionStatus {
  lastSprayDate: string | null
  daysSinceSpray: number | null
  protectionPct: number
  level: ProtectionLevel
}

// Personal / Stundenrapportierung

export interface Employee {
  id: string
  name: string
  createdBy: string
  createdAt: string
}

export interface WorkType {
  id: string
  name: string
  createdBy: string
  createdAt: string
}

export interface TimeEntry {
  id: string
  employeeId: string
  employee?: Employee
  workTypeId?: string
  workType?: WorkType
  vineyardId?: string
  entryDate: string
  hours: number
  description?: string
  createdBy: string
  createdAt: string
}

export interface EmployeeMonthStats {
  employeeId: string
  employeeName: string
  months: [number, number, number, number, number, number, number, number, number, number, number, number]
  total: number
}

// VintageJournal
export interface VintageJournal {
  id: string
  vineyardId: string
  year: number
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

// PruningRecord
export type SchnittTyp = 'Bogenschnitt' | 'Zapfenschnitt' | 'Minimalschnitt' | 'Sonstiges'

export interface PruningRecord {
  id: string
  vineyardId: string
  year: number
  pruningDate: string
  schnittTyp: SchnittTyp
  augenProRebe?: number
  notes?: string
  createdBy: string
  createdAt: string
}

// API response wrappers
export interface ApiError {
  error: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

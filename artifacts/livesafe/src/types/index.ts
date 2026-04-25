// ============================================================
// LiveSafe — Shared Type Definitions
// ============================================================

export type UserRole = 'citizen' | 'police' | 'admin' | 'super_admin'

/** CrimeGuard v5 shell navigation */
export type Screen =
  | 'landing'
  | 'dashboard'
  | 'hotspot'
  | 'simulation'
  | 'reports'
  | 'contacts'
  | 'settings'
  | 'sos'
  | 'analytics'
  | 'ml'
  | 'users'
  | 'report'

/** Runtime shape from GET /api/ml/metrics-v5 */
export interface MLMetricsV5 {
  cv_accuracy: number
  cv_accuracy_std?: number
  cv_f1_weighted?: number
  cv_f1_std?: number
  test_accuracy?: number
  test_f1_weighted?: number
  training_samples?: number
  base_records?: number
  feature_count?: number
  city_count?: number
  year_range?: string
  spatial_clusters?: number
  top_features?: string[]
  algorithm?: string
  cv_strategy?: string
  version?: string
}

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string
  badge_number?: string
  is_active: boolean
  created_at: string
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'reported' | 'verified' | 'resolved' | 'dismissed'
export type CrimeType =
  | 'theft'
  | 'robbery'
  | 'assault'
  | 'harassment'
  | 'vandalism'
  | 'burglary'
  | 'fraud'
  | 'cybercrime'
  | 'drug_offense'
  | 'kidnapping'
  | 'extortion'
  | 'other'

export interface Incident {
  id: string
  type: CrimeType
  description: string
  latitude: number
  longitude: number
  severity: SeverityLevel
  status: IncidentStatus
  reported_by: string
  verified_by?: string
  created_at: string
}

export type RiskClassification = 'low' | 'medium' | 'high' | 'critical'

export const RISK_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

export const RISK_BG: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border-red-100',
  high:     'bg-orange-50 text-orange-600 border-orange-100',
  medium:   'bg-yellow-50 text-yellow-600 border-yellow-100',
  low:      'bg-green-50 text-green-600 border-green-100',
}

export interface V5City {
  id: string
  city: string
  state: string
  lat: number
  lon: number
  risk_level: RiskClassification
  risk_score: number
  model_confidence: number
  crime_rate_per_lakh: number
  predicted_crimes: string[]
  primary_warning: string
  trend: 'rising' | 'stable' | 'falling'
  population_lakh: number
  radius_meters: number
}

export interface Hotspot {
  id: string
  latitude: number
  longitude: number
  risk_score: number          // 0–100
  classification: RiskClassification
  radius: number              // metres
  crime_count: number
  state: string               // "City, State"
  predicted_crimes: CrimeType[]
  primary_warning?: string    // ML-generated safety warning
  trend?: 'rising' | 'stable' | 'falling'
  model_confidence?: number   // 0–1
  created_at: string
}

export type SOSStatus = 'active' | 'acknowledged' | 'resolved'
export type SOSResponderRole = 'police' | 'family' | 'volunteer' | 'hospital'
export type SOSResponderState = 'queued' | 'notified' | 'accepted' | 'en_route' | 'standby'
export type SOSEvidenceReviewState = 'new' | 'flagged' | 'reviewed'

export interface SOSAlert {
  id: string
  user_id: string
  user_name?: string
  latitude: number
  longitude: number
  current_latitude?: number
  current_longitude?: number
  location_updated_at?: string
  trail?: Array<{ latitude: number; longitude: number; recorded_at: string }>
  events?: Array<{ id: string; type: string; detail: string; created_at: string }>
  responder_status?: Array<{
    id: string
    label: string
    role: SOSResponderRole
    status: SOSResponderState
    eta_minutes?: number
  }>
  evidence_items?: Array<{
    id: string
    type: 'audio' | 'video'
    label: string
    captured_at: string
    review_status: SOSEvidenceReviewState
  }>
  status: SOSStatus
  assigned_officer?: string
  response_time?: number      // seconds
  whatsapp_notifications_sent?: number
  escalated?: boolean
  safety_mode?: 'everyday' | 'night' | 'women' | 'student'
  last_checkin_at?: string
  notified_targets?: string[]
  evidence_count?: number
  acknowledged_at?: string
  resolved_at?: string
  created_at: string
}

export interface EmergencyContact {
  id: string
  user_id: string
  name: string
  phone: string
  created_at: string
}

export interface MLMetrics {
  accuracy: number            // 0–1
  precision: number
  recall: number
  f1_score: number
  sample_count: number
  last_trained: string
  model_version: string
}

export interface PredictionRequest {
  latitude: number
  longitude: number
  hour: number
  day_of_week: number
  month: number
}

export interface PredictionResult {
  risk_score: number
  classification: RiskClassification
  predicted_crimes: CrimeType[]
  confidence: number
}

export interface DashboardStats {
  total_incidents: number
  resolved_incidents: number
  active_sos_alerts: number
  hotspot_count: number
  response_time_avg: number
  crime_reduction_pct: number
}

// API Response envelope
export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

// Pagination
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

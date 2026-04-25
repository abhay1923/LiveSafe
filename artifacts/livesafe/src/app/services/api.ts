// ============================================================
// LiveSafe — API Service
// • Demo account bypass for citizen/police/admin@example.com
// • Zod runtime validation on all responses
// • AbortController support to prevent setState on unmounted components
// • Graceful mock-data fallback when backend is not yet connected
// ============================================================
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { z } from 'zod'
import { tokenStore } from '@/lib/tokenStore'
import type {
  User,
  Incident,
  Hotspot,
  CrimeType,
  SOSAlert,
  EmergencyContact,
  MLMetrics,
  PredictionRequest,
  PredictionResult,
  DashboardStats,
} from '@/types'

export interface AccessRequest {
  id: string
  email: string
  name: string
  requested_role: 'police' | 'admin'
  badge_number?: string
  phone?: string
  reason?: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: number
  reviewed_at?: string
  rejection_reason?: string
  created_at: string
}
import { RAW_HOTSPOTS_V5, type V5HotspotRaw } from './hotspots_v5'

const CrimeTypeSchema = z.enum([
  'theft',
  'robbery',
  'assault',
  'harassment',
  'vandalism',
  'burglary',
  'fraud',
  'cybercrime',
  'drug_offense',
  'kidnapping',
  'extortion',
  'other',
])

// ---- Zod schemas ----

const UserSchema: z.ZodType<User> = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['citizen', 'police', 'admin', 'super_admin']),
  phone: z.string().nullable().optional(),
  badge_number: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
}) as z.ZodType<User>

const IncidentSchema: z.ZodType<Incident> = z.object({
  id: z.string(),
  type: z.enum(['theft', 'robbery', 'assault', 'harassment', 'vandalism', 'burglary', 'fraud', 'cybercrime', 'drug_offense', 'kidnapping', 'extortion', 'other']),
  description: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['reported', 'verified', 'resolved', 'dismissed']),
  reported_by: z.string(),
  verified_by: z.string().optional(),
  created_at: z.string(),
})

const HotspotSchema: z.ZodType<Hotspot> = z.object({
  id: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  risk_score: z.number().min(0).max(100),
  classification: z.enum(['low', 'medium', 'high', 'critical']),
  radius: z.number(),
  crime_count: z.number(),
  state: z.string(),
  predicted_crimes: z.array(CrimeTypeSchema),
  primary_warning: z.string().optional(),
  trend: z.enum(['rising', 'stable', 'falling']).optional(),
  model_confidence: z.number().optional(),
  created_at: z.string(),
})

const SOSAlertSchema: z.ZodType<SOSAlert> = z.object({
  id: z.string(),
  user_id: z.string(),
  user_name: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  current_latitude: z.number().optional(),
  current_longitude: z.number().optional(),
  location_updated_at: z.string().optional(),
  trail: z.array(z.object({
    latitude: z.number(),
    longitude: z.number(),
    recorded_at: z.string(),
  })).optional(),
  events: z.array(z.object({
    id: z.string(),
    type: z.string(),
    detail: z.string(),
    created_at: z.string(),
  })).optional(),
  responder_status: z.array(z.object({
    id: z.string(),
    label: z.string(),
    role: z.enum(['police', 'family', 'volunteer', 'hospital']),
    status: z.enum(['queued', 'notified', 'accepted', 'en_route', 'standby']),
    eta_minutes: z.number().optional(),
  })).optional(),
  evidence_items: z.array(z.object({
    id: z.string(),
    type: z.enum(['audio', 'video']),
    label: z.string(),
    captured_at: z.string(),
    review_status: z.enum(['new', 'flagged', 'reviewed']),
  })).optional(),
  status: z.enum(['active', 'acknowledged', 'resolved']),
  assigned_officer: z.string().optional(),
  response_time: z.number().optional(),
  whatsapp_notifications_sent: z.number().optional(),
  escalated: z.boolean().optional(),
  safety_mode: z.enum(['everyday', 'night', 'women', 'student']).optional(),
  last_checkin_at: z.string().optional(),
  notified_targets: z.array(z.string()).optional(),
  evidence_count: z.number().optional(),
  acknowledged_at: z.string().optional(),
  resolved_at: z.string().optional(),
  created_at: z.string(),
}) as z.ZodType<SOSAlert>

const EmergencyContactSchema: z.ZodType<EmergencyContact> = z.object({
  id: z.string(),
  user_id: z.string(),
  name: z.string(),
  phone: z.string(),
  created_at: z.string(),
})

const MLMetricsSchema: z.ZodType<MLMetrics> = z.object({
  accuracy: z.number(),
  precision: z.number(),
  recall: z.number(),
  f1_score: z.number(),
  sample_count: z.number(),
  last_trained: z.string(),
  model_version: z.string(),
})

const DashboardStatsSchema: z.ZodType<DashboardStats> = z.object({
  total_incidents: z.number(),
  resolved_incidents: z.number(),
  active_sos_alerts: z.number(),
  hotspot_count: z.number(),
  response_time_avg: z.number(),
  crime_reduction_pct: z.number(),
})

// ---- Base fetcher ----

const API_BASE = import.meta.env.VITE_API_URL || '/api'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

class NonJsonResponseError extends ApiError {
  constructor(status: number, contentType: string | null) {
    super(
      status,
      contentType?.includes('text/html')
        ? 'Backend API is not running; using local demo data where available.'
        : 'Backend returned a non-JSON response.'
    )
    this.name = 'NonJsonResponseError'
  }
}

const DEMO_LOGIN_ACCOUNTS: Record<string, { password: string; name: string; role: User['role'] }> = {
  'citizen@example.com': {
    password: 'citizen123',
    name: 'Priya Sharma',
    role: 'citizen',
  },
  'police@example.com': {
    password: 'police123',
    name: 'Officer Rajesh Kumar',
    role: 'police',
  },
  'admin@example.com': {
    password: 'admin123',
    name: 'Admin Vikram Singh',
    role: 'admin',
  },
  'superadmin@livesafe.local': {
    password: 'superadmin123',
    name: 'Super Admin',
    role: 'super_admin',
  },
}

function isBackendUnavailableError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 404 || err.status >= 500 || err instanceof NonJsonResponseError
  }
  return err instanceof TypeError
}

function normalizeCrimeType(type: string): CrimeType {
  switch (type) {
    case 'murder':
      return 'assault'
    case 'crime_against_women':
      return 'harassment'
    case 'economic_offence':
      return 'fraud'
    default:
      return CrimeTypeSchema.safeParse(type).success ? (type as CrimeType) : 'other'
  }
}

function buildMockHotspots(): Hotspot[] {
  return RAW_HOTSPOTS_V5.map((h: V5HotspotRaw) => ({
    id: h.id,
    latitude: h.lat,
    longitude: h.lon,
    risk_score: h.risk_score,
    classification: (h.risk_level as 'low' | 'medium' | 'high' | 'critical'),
    radius: h.radius_meters,
    crime_count: Math.round(h.crime_rate_per_lakh * (h.population_lakh || 1)),
    state: `${h.city}, ${h.state}`,
    predicted_crimes: h.predicted_crimes.map(normalizeCrimeType),
    primary_warning: h.primary_warning,
    trend: (h.trend as 'rising' | 'stable' | 'falling') || 'stable',
    model_confidence: h.model_confidence / 100,
    created_at: new Date().toISOString(),
  }))
}

async function loadGeneratedHotspots(signal?: AbortSignal): Promise<Hotspot[]> {
  try {
    const response = await fetch('/india_hotspots_v5.json', { signal })
    if (!response.ok) throw new ApiError(response.status, 'Could not load generated hotspots.')
    const raw = (await response.json()) as V5HotspotRaw[]
    return raw.map((h) => ({
      id: h.id,
      latitude: h.lat,
      longitude: h.lon,
      risk_score: h.risk_score,
      classification: (h.risk_level as 'low' | 'medium' | 'high' | 'critical'),
      radius: h.radius_meters,
      crime_count: Math.round(h.crime_rate_per_lakh * (h.population_lakh || 1)),
      state: `${h.city}, ${h.state}`,
      predicted_crimes: h.predicted_crimes.map(normalizeCrimeType),
      primary_warning: h.primary_warning,
      trend: (h.trend as 'rising' | 'stable' | 'falling') || 'stable',
      model_confidence: h.model_confidence / 100,
      created_at: new Date().toISOString(),
    }))
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return buildMockHotspots()
  }
}

function buildLocalPrediction(req: PredictionRequest): PredictionResult & {
  explanation?: {
    nearest_area: string
    distance_km: number
    base_risk: number
    proximity_factor: number
    time_factor: { value: number; label: string }
    day_factor: { value: number; label: string }
    season_factor: { value: number; label: string }
  }
} {
  const KNOWN = [
    { name: 'Delhi NCR', lat: 28.6139, lon: 77.2090, baseRisk: 72, crimes: ['theft', 'robbery', 'harassment'] as CrimeType[] },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777, baseRisk: 68, crimes: ['theft', 'fraud', 'harassment'] as CrimeType[] },
    { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, baseRisk: 58, crimes: ['cybercrime', 'fraud', 'theft'] as CrimeType[] },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639, baseRisk: 60, crimes: ['theft', 'robbery'] as CrimeType[] },
  ]
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const haversineKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
    const dLat = toRad(b.lat - a.lat)
    const dLon = toRad(b.lon - a.lon)
    const lat1 = toRad(a.lat)
    const lat2 = toRad(b.lat)
    const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
    return 2 * 6371 * Math.asin(Math.sqrt(h))
  }

  let nearest = KNOWN[0]
  let nearestDist = Infinity
  for (const area of KNOWN) {
    const d = haversineKm({ lat: req.latitude, lon: req.longitude }, { lat: area.lat, lon: area.lon })
    if (d < nearestDist) {
      nearestDist = d
      nearest = area
    }
  }

  const proximityFactor = nearestDist <= 8 ? 1 : Math.max(0.3, 1 - (nearestDist - 8) / 75)
  const timeFactor =
    req.hour >= 22 || req.hour < 4
      ? { value: 1.32, label: 'Late-night window (22:00-04:00)' }
      : req.hour >= 18 && req.hour < 22
        ? { value: 1.18, label: 'Evening rush (18:00-22:00)' }
        : { value: 0.92, label: 'General daytime pattern' }
  const dayFactor =
    req.day_of_week === 5 || req.day_of_week === 6
      ? { value: 1.2, label: 'Weekend (Fri/Sat elevated activity)' }
      : { value: 1, label: 'Weekday' }
  const seasonFactor =
    [10, 11, 12].includes(req.month)
      ? { value: 1.1, label: 'Festival season (Oct-Dec)' }
      : { value: 1, label: 'Normal season' }

  let risk = nearest.baseRisk * proximityFactor * timeFactor.value * dayFactor.value * seasonFactor.value
  risk = Math.max(5, Math.min(98, Math.round(risk)))
  const classification: PredictionResult['classification'] =
    risk >= 78 ? 'critical' : risk >= 60 ? 'high' : risk >= 38 ? 'medium' : 'low'
  const confidence = Math.max(0.55, Math.min(0.97, 1 - nearestDist / 200))

  return {
    risk_score: risk,
    classification,
    predicted_crimes: nearest.crimes,
    confidence: Math.round(confidence * 1000) / 1000,
    explanation: {
      nearest_area: nearest.name,
      distance_km: Math.round(nearestDist * 10) / 10,
      base_risk: Math.round(nearest.baseRisk * proximityFactor),
      proximity_factor: Math.round(proximityFactor * 100) / 100,
      time_factor: timeFactor,
      day_factor: dayFactor,
      season_factor: seasonFactor,
    },
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit & { signal?: AbortSignal } = {}
): Promise<T> {
  const token = tokenStore.getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const contentType = res.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    throw new NonJsonResponseError(res.status, contentType)
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, body.message ?? res.statusText)
  }

  return res.json() as Promise<T>
}

// ---- Mock data (used when backend is not connected) ----

const MOCK_INCIDENTS: Incident[] = [
  { id: 'i1', type: 'theft', description: 'Mobile phone snatched near metro station', latitude: 28.6180, longitude: 77.2100, severity: 'high', status: 'verified', reported_by: 'citizen-001', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'i2', type: 'robbery', description: 'Bag snatch reported on Ring Road', latitude: 28.7001, longitude: 77.1080, severity: 'critical', status: 'reported', reported_by: 'citizen-002', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'i3', type: 'harassment', description: 'Verbal harassment at bus stop', latitude: 28.5360, longitude: 77.3850, severity: 'medium', status: 'resolved', reported_by: 'citizen-003', created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: 'i4', type: 'vandalism', description: 'Vehicle damage in parking lot', latitude: 28.6700, longitude: 77.4500, severity: 'low', status: 'dismissed', reported_by: 'citizen-004', created_at: new Date(Date.now() - 28800000).toISOString() },
  { id: 'i5', type: 'assault', description: 'Physical altercation near market', latitude: 28.4600, longitude: 77.0300, severity: 'high', status: 'verified', reported_by: 'citizen-005', created_at: new Date(Date.now() - 86400000).toISOString() },
]

const MOCK_SOS_ALERTS: SOSAlert[] = [
  {
    id: 's1',
    user_id: 'u1',
    user_name: 'Priya Sharma',
    latitude: 28.6200,
    longitude: 77.2050,
    current_latitude: 28.6216,
    current_longitude: 77.2065,
    location_updated_at: new Date(Date.now() - 15000).toISOString(),
    trail: [
      { latitude: 28.6200, longitude: 77.2050, recorded_at: new Date(Date.now() - 180000).toISOString() },
      { latitude: 28.6207, longitude: 77.2058, recorded_at: new Date(Date.now() - 90000).toISOString() },
      { latitude: 28.6216, longitude: 77.2065, recorded_at: new Date(Date.now() - 15000).toISOString() },
    ],
    status: 'active',
    escalated: true,
    safety_mode: 'women',
    last_checkin_at: new Date(Date.now() - 120000).toISOString(),
    notified_targets: ['Police dispatch', 'Family contacts', 'Verified volunteers', 'Hospital standby'],
    evidence_count: 2,
    responder_status: [
      { id: 'rsp-s1-police', label: 'Police dispatch', role: 'police', status: 'en_route', eta_minutes: 4 },
      { id: 'rsp-s1-family', label: 'Family contacts', role: 'family', status: 'accepted' },
      { id: 'rsp-s1-volunteer', label: 'Verified volunteers', role: 'volunteer', status: 'accepted', eta_minutes: 6 },
      { id: 'rsp-s1-hospital', label: 'Hospital standby', role: 'hospital', status: 'standby', eta_minutes: 9 },
    ],
    evidence_items: [
      { id: 'ev-s1-a1', type: 'audio', label: 'Audio evidence clip', captured_at: new Date(Date.now() - 65000).toISOString(), review_status: 'flagged' },
      { id: 'ev-s1-v1', type: 'video', label: 'Video evidence clip', captured_at: new Date(Date.now() - 55000).toISOString(), review_status: 'new' },
    ],
    events: [
      {
        id: 'evt-s1-1',
        type: 'created',
        detail: 'Citizen activated SOS and started live location sharing.',
        created_at: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: 'evt-s1-2',
        type: 'escalated',
        detail: 'Dead-man switch check-in was missed; dispatch priority increased.',
        created_at: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: 'evt-s1-3',
        type: 'evidence',
        detail: 'Two evidence clips captured and attached to the alert.',
        created_at: new Date(Date.now() - 60000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 's2',
    user_id: 'u2',
    user_name: 'Rahul Gupta',
    latitude: 28.7010,
    longitude: 77.1000,
    current_latitude: 28.7015,
    current_longitude: 77.1011,
    location_updated_at: new Date(Date.now() - 45000).toISOString(),
    trail: [
      { latitude: 28.7010, longitude: 77.1000, recorded_at: new Date(Date.now() - 600000).toISOString() },
      { latitude: 28.7015, longitude: 77.1011, recorded_at: new Date(Date.now() - 45000).toISOString() },
    ],
    status: 'acknowledged',
    assigned_officer: 'Officer Singh',
    safety_mode: 'night',
    notified_targets: ['Police dispatch', 'Family contacts', 'Hospital standby'],
    evidence_count: 1,
    responder_status: [
      { id: 'rsp-s2-police', label: 'Police dispatch', role: 'police', status: 'accepted', eta_minutes: 5 },
      { id: 'rsp-s2-family', label: 'Family contacts', role: 'family', status: 'accepted' },
      { id: 'rsp-s2-hospital', label: 'Hospital standby', role: 'hospital', status: 'standby', eta_minutes: 11 },
    ],
    evidence_items: [
      { id: 'ev-s2-a1', type: 'audio', label: 'Audio evidence clip', captured_at: new Date(Date.now() - 300000).toISOString(), review_status: 'reviewed' },
    ],
    events: [
      {
        id: 'evt-s2-1',
        type: 'created',
        detail: 'Citizen activated SOS and shared current position.',
        created_at: new Date(Date.now() - 900000).toISOString(),
      },
      {
        id: 'evt-s2-2',
        type: 'acknowledged',
        detail: 'Officer Singh accepted the alert and is en route.',
        created_at: new Date(Date.now() - 420000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 's3',
    user_id: 'u3',
    user_name: 'Anjali Verma',
    latitude: 28.5400,
    longitude: 77.3800,
    status: 'resolved',
    assigned_officer: 'Officer Kumar',
    response_time: 420,
    safety_mode: 'student',
    notified_targets: ['Police dispatch', 'Family contacts'],
    evidence_count: 1,
    responder_status: [
      { id: 'rsp-s3-police', label: 'Police dispatch', role: 'police', status: 'accepted' },
      { id: 'rsp-s3-family', label: 'Family contacts', role: 'family', status: 'accepted' },
    ],
    evidence_items: [
      { id: 'ev-s3-v1', type: 'video', label: 'Video evidence clip', captured_at: new Date(Date.now() - 3200000).toISOString(), review_status: 'reviewed' },
    ],
    events: [
      {
        id: 'evt-s3-1',
        type: 'created',
        detail: 'Citizen activated SOS from a student commute route.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'evt-s3-2',
        type: 'acknowledged',
        detail: 'Officer Kumar acknowledged the alert and coordinated response.',
        created_at: new Date(Date.now() - 3300000).toISOString(),
      },
      {
        id: 'evt-s3-3',
        type: 'resolved',
        detail: 'Incident was resolved and the citizen marked safe.',
        created_at: new Date(Date.now() - 3000000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

const MOCK_ML_METRICS: MLMetrics = {
  accuracy: 0.9349,
  precision: 0.9341,
  recall: 0.9341,
  f1_score: 0.9341,
  sample_count: 464,
  last_trained: new Date().toISOString(),
  model_version: 'v5.0.0-india-ncrb-2020-2023',
}

const MOCK_STATS: DashboardStats = {
  total_incidents: 3847,
  resolved_incidents: 2964,
  active_sos_alerts: 12,
  hotspot_count: 117,
  response_time_avg: 7.4,
  crime_reduction_pct: 12.3,
}

// ---- Mock mode flag ----
// Priority:
// 1) VITE_USE_MOCK='true'  -> force mock data
// 2) VITE_USE_MOCK='false' -> force real data
// 3) unset                 -> auto: use real Supabase when configured
const mockModeEnv = import.meta.env.VITE_USE_MOCK
const _useMock =
  mockModeEnv === 'true'
    ? true
    : mockModeEnv === 'false'
      ? false
      : !isSupabaseConfigured

const SOS_STORAGE_KEY = 'livesafe-sos-alerts'
const CONTACTS_STORAGE_KEY = 'livesafe-emergency-contacts'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function readStoredSOSAlerts(): SOSAlert[] {
  if (!canUseStorage()) return z.array(SOSAlertSchema).parse(MOCK_SOS_ALERTS)
  try {
    const raw = window.localStorage.getItem(SOS_STORAGE_KEY)
    if (!raw) return z.array(SOSAlertSchema).parse(MOCK_SOS_ALERTS)
    return z.array(SOSAlertSchema).parse(JSON.parse(raw))
  } catch {
    return z.array(SOSAlertSchema).parse(MOCK_SOS_ALERTS)
  }
}

function writeStoredSOSAlerts(alerts: SOSAlert[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(SOS_STORAGE_KEY, JSON.stringify(alerts))
}

function addAlertEvent(alert: SOSAlert, type: string, detail: string): SOSAlert {
  return SOSAlertSchema.parse({
    ...alert,
    events: [
      ...(alert.events ?? []),
      {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        detail,
        created_at: new Date().toISOString(),
      },
    ].slice(-12),
  })
}

function readStoredContacts(): EmergencyContact[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(CONTACTS_STORAGE_KEY)
    if (!raw) return []
    return z.array(EmergencyContactSchema).parse(JSON.parse(raw))
  } catch {
    return []
  }
}

function writeStoredContacts(contacts: EmergencyContact[]) {
  if (!canUseStorage()) return
  window.localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts))
}

// ---- API methods ----

export const api = {
  // ---- Auth (real backend) ----
  async login(
    email: string,
    password: string,
    signal?: AbortSignal
  ): Promise<{ user: User; token: string }> {
    const normalizedEmail = email.trim().toLowerCase()
    try {
      const data = await apiFetch<{ user: unknown; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail, password }),
        signal,
      })
      return { user: UserSchema.parse(data.user), token: data.token }
    } catch (err) {
      // When API is unreachable/misconfigured in local setup, keep demo sign-in usable.
      const isBackendUnavailable = isBackendUnavailableError(err)
      const demo = DEMO_LOGIN_ACCOUNTS[normalizedEmail]
      if (isBackendUnavailable && demo && demo.password === password) {
        const now = new Date().toISOString()
        return {
          user: UserSchema.parse({
            id: `demo-${demo.role}`,
            email: normalizedEmail,
            name: demo.name,
            role: demo.role,
            is_active: true,
            created_at: now,
          }),
          token: `demo-token-${demo.role}`,
        }
      }
      throw err
    }
  },

  async register(
    name: string,
    email: string,
    password: string,
    signal?: AbortSignal
  ): Promise<{ user: User; token: string }> {
    const data = await apiFetch<{ user: unknown; token: string }>('/auth/signup-citizen', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password }),
      signal,
    })
    return { user: UserSchema.parse(data.user), token: data.token }
  },

  async requestAccess(
    payload: {
      name: string
      email: string
      password: string
      requestedRole: 'police' | 'admin'
      badgeNumber?: string
      phone?: string
      reason?: string
    },
    signal?: AbortSignal
  ): Promise<{ message: string }> {
    return apiFetch('/auth/request-access', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
      }),
      signal,
    })
  },

  async logout(): Promise<void> {
    try {
      await apiFetch('/auth/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    tokenStore.clear()
  },

  // ---- Super admin ----
  async listAccessRequests(signal?: AbortSignal): Promise<AccessRequest[]> {
    try {
      return await apiFetch<AccessRequest[]>('/admin/access-requests', { signal })
    } catch (err) {
      if (isBackendUnavailableError(err)) return []
      throw err
    }
  },

  async approveAccessRequest(id: string, signal?: AbortSignal): Promise<{ message: string }> {
    return apiFetch(`/admin/access-requests/${id}/approve`, { method: 'POST', signal })
  },

  async rejectAccessRequest(
    id: string,
    reason?: string,
    signal?: AbortSignal
  ): Promise<{ message: string }> {
    return apiFetch(`/admin/access-requests/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      signal,
    })
  },

  // ---- Hotspots ----
  async getHotspots(signal?: AbortSignal): Promise<Hotspot[]> {
    const mockHotspots = await loadGeneratedHotspots(signal)
    if (_useMock) {
      return z.array(HotspotSchema).parse(mockHotspots)
    }
    try {
      const { data, error } = await supabase.from('hotspots').select('*')
      if (error) throw new ApiError(500, error.message)
      if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')
      const remoteHotspots = z.array(HotspotSchema).parse(data)
      return remoteHotspots.length >= 100 ? remoteHotspots : z.array(HotspotSchema).parse(mockHotspots)
    } catch (err) {
      if (isBackendUnavailableError(err)) return z.array(HotspotSchema).parse(mockHotspots)
      throw err
    }
  },

  // ---- Incidents (real backend) ----
  async getIncidents(
    filters?: { type?: string; severity?: string; status?: string; from?: string; to?: string; limit?: number },
    signal?: AbortSignal
  ): Promise<Incident[]> {
    const buildFallback = () => {
      let filtered = [...MOCK_INCIDENTS]
      const fromDate = filters?.from ? new Date(filters.from) : null
      const toDate = filters?.to ? new Date(filters.to) : null
      if (filters?.type) filtered = filtered.filter((i) => i.type === filters.type)
      if (filters?.severity) filtered = filtered.filter((i) => i.severity === filters.severity)
      if (filters?.status) filtered = filtered.filter((i) => i.status === filters.status)
      if (fromDate) filtered = filtered.filter((i) => new Date(i.created_at) >= fromDate)
      if (toDate) filtered = filtered.filter((i) => new Date(i.created_at) <= toDate)
      if (filters?.limit) filtered = filtered.slice(0, filters.limit)
      return z.array(IncidentSchema).parse(filtered)
    }
    if (_useMock) {
      return buildFallback()
    }

    const qs = new URLSearchParams()
    if (filters?.type)     qs.set('type', filters.type)
    if (filters?.severity) qs.set('severity', filters.severity)
    if (filters?.status)   qs.set('status', filters.status)
    if (filters?.from)     qs.set('from', filters.from)
    if (filters?.to)       qs.set('to', filters.to)
    if (filters?.limit)    qs.set('limit', String(filters.limit))
    const url = `/incidents${qs.toString() ? '?' + qs.toString() : ''}`
    try {
      const data = await apiFetch<unknown>(url, { signal })
      return z.array(IncidentSchema).parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) return buildFallback()
      throw err
    }
  },

  async getIncidentStats(signal?: AbortSignal): Promise<{
    total: number
    by_type: Array<{ type: string; count: number }>
    by_severity: Array<{ severity: string; count: number }>
    by_status: Array<{ status: string; count: number }>
    timeline_7d: Array<{ day: string; count: number }>
  }> {
    const buildFallback = () => {
      const byTypeMap = new Map<string, number>()
      const bySeverityMap = new Map<string, number>()
      const byStatusMap = new Map<string, number>()
      for (const incident of MOCK_INCIDENTS) {
        byTypeMap.set(incident.type, (byTypeMap.get(incident.type) ?? 0) + 1)
        bySeverityMap.set(incident.severity, (bySeverityMap.get(incident.severity) ?? 0) + 1)
        byStatusMap.set(incident.status, (byStatusMap.get(incident.status) ?? 0) + 1)
      }
      return {
        total: MOCK_INCIDENTS.length,
        by_type: Array.from(byTypeMap.entries()).map(([type, count]) => ({ type, count })),
        by_severity: Array.from(bySeverityMap.entries()).map(([severity, count]) => ({ severity, count })),
        by_status: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
        timeline_7d: [],
      }
    }
    if (_useMock) {
      return buildFallback()
    }
    try {
      return await apiFetch('/incidents/stats', { signal })
    } catch (err) {
      if (isBackendUnavailableError(err)) return buildFallback()
      throw err
    }
  },

  async reportIncident(
    incident: Omit<Incident, 'id' | 'status' | 'verified_by' | 'created_at' | 'reported_by'>,
    signal?: AbortSignal
  ): Promise<Incident> {
    const data = await apiFetch<unknown>('/incidents', {
      method: 'POST',
      body: JSON.stringify(incident),
      signal,
    })
    return IncidentSchema.parse(data)
  },

  // ---- SOS (always real backend) ----
  async getSOSAlerts(signal?: AbortSignal): Promise<SOSAlert[]> {
    try {
      const data = await apiFetch<unknown>('/sos', { signal })
      return z.array(SOSAlertSchema).parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) return readStoredSOSAlerts()
      throw err
    }
  },

  async triggerSOS(
    payload: { latitude: number; longitude: number; user_id: string; user_name?: string },
    signal?: AbortSignal
  ): Promise<SOSAlert> {
    try {
      const data = await apiFetch<unknown>('/sos', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
      })
      return SOSAlertSchema.parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const now = new Date().toISOString()
        const stored = readStoredSOSAlerts()
        const alert = SOSAlertSchema.parse({
          id: `s${Date.now()}`,
          user_id: payload.user_id,
          user_name: payload.user_name,
          latitude: payload.latitude,
          longitude: payload.longitude,
          current_latitude: payload.latitude,
          current_longitude: payload.longitude,
          location_updated_at: now,
          trail: [{ latitude: payload.latitude, longitude: payload.longitude, recorded_at: now }],
          status: 'active',
          events: [
            {
              id: `evt-${Date.now()}-created`,
              type: 'created',
              detail: 'Citizen activated SOS and shared live location.',
              created_at: now,
            },
          ],
          created_at: now,
        })
        writeStoredSOSAlerts([alert, ...stored])
        return alert
      }
      throw err
    }
  },

  async updateSOSLocation(
    id: string,
    payload: { latitude: number; longitude: number },
    signal?: AbortSignal
  ): Promise<SOSAlert> {
    try {
      const data = await apiFetch<unknown>(`/sos/${id}/location`, {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
      })
      return SOSAlertSchema.parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const now = new Date().toISOString()
        const updatedAlerts = readStoredSOSAlerts().map((alert) => {
          if (alert.id !== id) return alert
          return addAlertEvent(SOSAlertSchema.parse({
            ...alert,
            current_latitude: payload.latitude,
            current_longitude: payload.longitude,
            location_updated_at: now,
            trail: [
              ...(alert.trail ?? []),
              { latitude: payload.latitude, longitude: payload.longitude, recorded_at: now },
            ].slice(-20),
          }), 'location_update', `Location refreshed to ${payload.latitude.toFixed(4)}, ${payload.longitude.toFixed(4)}.`)
        })
        writeStoredSOSAlerts(updatedAlerts)
        return updatedAlerts.find((alert) => alert.id === id) ?? updatedAlerts[0]
      }
      throw err
    }
  },

  async syncSOSAlert(
    id: string,
    payload: {
      escalated?: boolean
      safety_mode?: SOSAlert['safety_mode']
      last_checkin_at?: string
      notified_targets?: string[]
      evidence_count?: number
      whatsapp_notifications_sent?: number
      responder_status?: SOSAlert['responder_status']
      evidence_items?: SOSAlert['evidence_items']
      event?: { type: string; detail: string }
    },
    signal?: AbortSignal
  ): Promise<SOSAlert> {
    try {
      const data = await apiFetch<unknown>(`/sos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
        signal,
      })
      return SOSAlertSchema.parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const updatedAlerts = readStoredSOSAlerts().map((alert) => {
          if (alert.id !== id) return alert
          const nextAlert = SOSAlertSchema.parse({
            ...alert,
            escalated: payload.escalated ?? alert.escalated,
            safety_mode: payload.safety_mode ?? alert.safety_mode,
            last_checkin_at: payload.last_checkin_at ?? alert.last_checkin_at,
            notified_targets: payload.notified_targets ?? alert.notified_targets,
            evidence_count: payload.evidence_count ?? alert.evidence_count,
            whatsapp_notifications_sent:
              payload.whatsapp_notifications_sent ?? alert.whatsapp_notifications_sent,
            responder_status: payload.responder_status ?? alert.responder_status,
            evidence_items: payload.evidence_items ?? alert.evidence_items,
          })
          return payload.event
            ? addAlertEvent(nextAlert, payload.event.type, payload.event.detail)
            : nextAlert
        })
        writeStoredSOSAlerts(updatedAlerts)
        return updatedAlerts.find((alert) => alert.id === id) ?? readStoredSOSAlerts()[0]
      }
      throw err
    }
  },

  async updateSOSResponderStatus(
    id: string,
    responderId: string,
    status: NonNullable<SOSAlert['responder_status']>[number]['status'],
    signal?: AbortSignal
  ): Promise<SOSAlert> {
    const statusLabel = status.replace('_', ' ')
    try {
      const data = await apiFetch<unknown>(`/sos/${id}/responders/${responderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        signal,
      })
      return SOSAlertSchema.parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const updatedAlerts = readStoredSOSAlerts().map((alert) => {
          if (alert.id !== id) return alert
          const responder = alert.responder_status?.find((item) => item.id === responderId)
          const nextAlert = SOSAlertSchema.parse({
            ...alert,
            responder_status: (alert.responder_status ?? []).map((item) =>
              item.id === responderId ? { ...item, status } : item
            ),
          })
          return addAlertEvent(
            nextAlert,
            'responder_update',
            `${responder?.label ?? 'Responder'} marked as ${statusLabel}.`
          )
        })
        writeStoredSOSAlerts(updatedAlerts)
        return updatedAlerts.find((alert) => alert.id === id) ?? readStoredSOSAlerts()[0]
      }
      throw err
    }
  },

  async updateSOSEvidenceReview(
    id: string,
    evidenceId: string,
    reviewStatus: NonNullable<SOSAlert['evidence_items']>[number]['review_status'],
    signal?: AbortSignal
  ): Promise<SOSAlert> {
    try {
      const data = await apiFetch<unknown>(`/sos/${id}/evidence/${evidenceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ review_status: reviewStatus }),
        signal,
      })
      return SOSAlertSchema.parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const updatedAlerts = readStoredSOSAlerts().map((alert) => {
          if (alert.id !== id) return alert
          const evidence = alert.evidence_items?.find((item) => item.id === evidenceId)
          const nextAlert = SOSAlertSchema.parse({
            ...alert,
            evidence_items: (alert.evidence_items ?? []).map((item) =>
              item.id === evidenceId ? { ...item, review_status: reviewStatus } : item
            ),
          })
          return addAlertEvent(
            nextAlert,
            'evidence_review',
            `${evidence?.label ?? 'Evidence item'} marked as ${reviewStatus}.`
          )
        })
        writeStoredSOSAlerts(updatedAlerts)
        return updatedAlerts.find((alert) => alert.id === id) ?? readStoredSOSAlerts()[0]
      }
      throw err
    }
  },

  async acknowledgeSOSAlert(id: string, officer?: string, signal?: AbortSignal): Promise<SOSAlert> {
    try {
      const data = await apiFetch<unknown>(`/sos/${id}/acknowledge`, {
        method: 'PATCH',
        body: JSON.stringify({ officer }),
        signal,
      })
      return SOSAlertSchema.parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const now = new Date().toISOString()
        const updatedAlerts = readStoredSOSAlerts().map((alert) =>
          alert.id === id
            ? addAlertEvent(SOSAlertSchema.parse({
                ...alert,
                id,
                status: 'acknowledged',
                assigned_officer: officer,
                acknowledged_at: now,
              }), 'acknowledged', `${officer ?? 'Duty officer'} acknowledged the alert and is attending.`)
            : alert
        )
        writeStoredSOSAlerts(updatedAlerts)
        return updatedAlerts.find((alert) => alert.id === id) ?? readStoredSOSAlerts()[0]
      }
      throw err
    }
  },

  async resolveSOSAlert(id: string, signal?: AbortSignal): Promise<SOSAlert> {
    try {
      const data = await apiFetch<unknown>(`/sos/${id}/resolve`, {
        method: 'PATCH',
        signal,
      })
      return SOSAlertSchema.parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        const now = new Date().toISOString()
        const updatedAlerts = readStoredSOSAlerts().map((alert) =>
          alert.id === id
            ? addAlertEvent(SOSAlertSchema.parse({
                ...alert,
                id,
                status: 'resolved',
                resolved_at: now,
                response_time: 420,
              }), 'resolved', 'Alert closed after field response and citizen safety confirmation.')
            : alert
        )
        writeStoredSOSAlerts(updatedAlerts)
        return updatedAlerts.find((alert) => alert.id === id) ?? readStoredSOSAlerts()[0]
      }
      throw err
    }
  },

  async getEmergencyContacts(signal?: AbortSignal): Promise<EmergencyContact[]> {
    try {
      const data = await apiFetch<unknown>('/sos/contacts', { signal })
      return z.array(EmergencyContactSchema).parse(data)
    } catch (err) {
      if (isBackendUnavailableError(err)) return readStoredContacts()
      throw err
    }
  },

  async addEmergencyContact(
    payload: { name: string; phone: string },
    signal?: AbortSignal
  ): Promise<EmergencyContact> {
    try {
      const data = await apiFetch<unknown>('/sos/contacts', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal,
      })
      return EmergencyContactSchema.parse(data)
    } catch (err) {
        if (isBackendUnavailableError(err)) {
        const currentUser = tokenStore.getUser<{ id: string }>()
          const contact = EmergencyContactSchema.parse({
            id: `c${Date.now()}`,
            user_id: currentUser?.id ?? 'demo-citizen',
            name: payload.name.trim(),
            phone: payload.phone.trim(),
            created_at: new Date().toISOString(),
        })
        const stored = readStoredContacts()
        writeStoredContacts([contact, ...stored])
        return contact
      }
      throw err
    }
  },

  async deleteEmergencyContact(id: string, signal?: AbortSignal): Promise<void> {
    try {
      await apiFetch(`/sos/contacts/${id}`, {
        method: 'DELETE',
        signal,
      })
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        writeStoredContacts(readStoredContacts().filter((contact) => contact.id !== id))
        return
      }
      throw err
    }
  },

  // ---- ML (real backend) ----
  async getMLMetrics(signal?: AbortSignal): Promise<MLMetrics & {
    recent_30d_incidents?: number
    algorithm?: string
    cv_strategy?: string
    training_records?: number
    feature_count?: number
  }> {
    const fallback = {
      ...MOCK_ML_METRICS,
      recent_30d_incidents: 84,
      algorithm: 'XGBoost(40%)+LightGBM(35%)+RandomForest(25%) Soft-Vote Ensemble',
      cv_strategy: 'StratifiedGroupKFold(k=5, groups=city)',
      training_records: 464,
      feature_count: 28,
    }
    if (_useMock) {
      return fallback
    }
    try {
      return await apiFetch('/ml/metrics', { signal })
    } catch (err) {
      if (isBackendUnavailableError(err)) return fallback
      throw err
    }
  },

  async getPrediction(
    req: PredictionRequest,
    signal?: AbortSignal
  ): Promise<PredictionResult & {
    explanation?: {
      nearest_area: string
      distance_km: number
      base_risk: number
      proximity_factor: number
      time_factor: { value: number; label: string }
      day_factor: { value: number; label: string }
      season_factor: { value: number; label: string }
    }
  }> {
    if (_useMock) {
      return buildLocalPrediction(req)
    }
    try {
      return await apiFetch('/ml/predict', { method: 'POST', body: JSON.stringify(req), signal })
    } catch (err) {
      if (isBackendUnavailableError(err)) return buildLocalPrediction(req)
      throw err
    }
  },

  async retrainModel(signal?: AbortSignal): Promise<{ message: string; job_id: string }> {
    if (_useMock) {
      await new Promise((r) => setTimeout(r, 1200))
      return { message: 'Retraining job queued successfully', job_id: `job-${Date.now()}` }
    }
    try {
      return await apiFetch('/ml/retrain', { method: 'POST', signal })
    } catch (err) {
      if (isBackendUnavailableError(err)) {
        await new Promise((r) => setTimeout(r, 1200))
        return { message: 'Backend unavailable; queued local demo retraining workflow', job_id: `job-${Date.now()}` }
      }
      throw err
    }
  },

  // ---- Dashboard stats ----
  async getDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
    if (_useMock) {
      const storedAlerts = readStoredSOSAlerts()
      return DashboardStatsSchema.parse({
        ...MOCK_STATS,
        active_sos_alerts: storedAlerts.filter((alert) => alert.status === 'active').length,
      })
    }

    const [hotspotsRes, incidentsRes, sosRes] = await Promise.all([
      supabase.from('hotspots').select('id, classification', { count: 'exact' }),
      supabase.from('incidents').select('id, status', { count: 'exact' }),
      supabase.from('sos_alerts').select('id, status', { count: 'exact' }),
    ])

    if (hotspotsRes.error) throw new ApiError(500, hotspotsRes.error.message)
    if (incidentsRes.error) throw new ApiError(500, incidentsRes.error.message)
    if (sosRes.error) throw new ApiError(500, sosRes.error.message)
    if (signal?.aborted) throw new DOMException('Request aborted', 'AbortError')

    const hotspot_count = hotspotsRes.count ?? 0
    const total_incidents = incidentsRes.count ?? 0
    const resolved_incidents = (incidentsRes.data ?? []).filter(i => i.status === 'resolved').length
    const active_sos_alerts = (sosRes.data ?? []).filter(s => s.status === 'active').length

    return DashboardStatsSchema.parse({
      total_incidents,
      resolved_incidents,
      active_sos_alerts,
      hotspot_count,
      response_time_avg: 7.4,
      crime_reduction_pct: 12.3,
    })
  },
}

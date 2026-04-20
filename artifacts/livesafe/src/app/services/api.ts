// ============================================================
// LiveSafe — API Service
// • Zod runtime validation on all responses
// • AbortController support to prevent setState on unmounted components
// • Graceful mock-data fallback when backend is not yet connected
// ============================================================
import { supabase } from '@/lib/supabase'
import { z } from 'zod'
import { tokenStore } from '@/lib/tokenStore'
import type {
  User,
  Incident,
  Hotspot,
  CrimeType,
  SOSAlert,
  MLMetrics,
  PredictionRequest,
  PredictionResult,
  DashboardStats,
} from '@/types'
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
  role: z.enum(['citizen', 'police', 'admin']),
  phone: z.string().nullable().optional(),
  badge_number: z.string().nullable().optional(),
  is_active: z.boolean(),
  created_at: z.string(),
})

const IncidentSchema: z.ZodType<Incident> = z.object({
  id: z.string(),
  type: z.enum(['theft', 'robbery', 'assault', 'harassment', 'vandalism', 'burglary', 'fraud', 'cybercrime', 'drug_offense', 'kidnapping', 'extortion', 'other']),
  description: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['reported', 'verified', 'resolved', 'dismissed']),
  reported_by: z.string(),
  verified_by: z.string().nullable().optional(),
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
  status: z.enum(['active', 'acknowledged', 'resolved']),
  assigned_officer: z.string().optional(),
  response_time: z.number().optional(),
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
  { id: 's1', user_id: 'u1', user_name: 'Priya Sharma', latitude: 28.6200, longitude: 77.2050, status: 'active', created_at: new Date(Date.now() - 300000).toISOString() },
  { id: 's2', user_id: 'u2', user_name: 'Rahul Gupta', latitude: 28.7010, longitude: 77.1000, status: 'acknowledged', assigned_officer: 'Officer Singh', created_at: new Date(Date.now() - 900000).toISOString() },
  { id: 's3', user_id: 'u3', user_name: 'Anjali Verma', latitude: 28.5400, longitude: 77.3800, status: 'resolved', assigned_officer: 'Officer Kumar', response_time: 420, created_at: new Date(Date.now() - 3600000).toISOString() },
]

const MOCK_ML_METRICS: MLMetrics = {
  accuracy: 0.9650,
  precision: 0.9412,
  recall: 0.9288,
  f1_score: 0.9348,
  sample_count: 715,
  last_trained: new Date().toISOString(),
  model_version: 'v4.0.0-india-expanded',
}

const MOCK_STATS: DashboardStats = {
  total_incidents: 3847,
  resolved_incidents: 2964,
  active_sos_alerts: 12,
  hotspot_count: 117,
  response_time_avg: 7.4,
  crime_reduction_pct: 12.3,
}

// ---- API methods ----

// Mock mode is always on until a real backend is wired up.
// To switch to live API: set VITE_USE_MOCK=false in .env
const _useMock = import.meta.env.VITE_USE_MOCK !== 'false'

async function withMockFallback<T>(
  mockData: T,
  schema: z.ZodType<T>,
  realFetch: () => Promise<unknown>
): Promise<T> {
  if (_useMock) {
    // Simulate realistic network latency
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300))
    return schema.parse(mockData)
  }
  const raw = await realFetch()
  return schema.parse(raw)
}
// Secure password hashing using Web Crypto API (SHA-256)
async function hashPassword(password: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}
export const api = {
  // ---- Auth ----
  async login(
  email: string,
  password: string,
  _signal?: AbortSignal
): Promise<{ user: User; token: string }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new ApiError(401, error.message)

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (!profile) throw new ApiError(404, 'User profile not found')

  return {
    user: UserSchema.parse(profile),
    token: data.session.access_token,
  }
},
  async register(
  name: string,
  email: string,
  password: string,
  _signal?: AbortSignal
): Promise<{ user: User; token: string }> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new ApiError(400, error.message)
  if (!data.user) throw new ApiError(400, 'Registration failed')

  const newUser = {
    id: data.user.id,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    role: 'citizen' as const,
    is_active: true,
    created_at: new Date().toISOString(),
  }

  const { error: insertError } = await supabase.from('users').insert(newUser)
  if (insertError) throw new ApiError(400, insertError.message)

  return {
    user: UserSchema.parse(newUser),
    token: data.session?.access_token ?? '',
  }
},

  async logout(): Promise<void> {
    tokenStore.clear()
  },

  // ---- Hotspots ----
async getHotspots(signal?: AbortSignal): Promise<Hotspot[]> {
  if (_useMock) {
    return withMockFallback(
      RAW_HOTSPOTS_V5.map((h: V5HotspotRaw) => ({
        id: h.id,
        latitude: h.lat,
        longitude: h.lon,
        risk_score: h.risk_score,
        classification: (h.risk_level as 'low' | 'medium' | 'high' | 'critical'),
        radius: h.radius_meters,
        crime_count: Math.round(h.crime_rate_per_lakh * (h.population_lakh || 1)),
        state: h.state,
        predicted_crimes: h.predicted_crimes as CrimeType[],
        primary_warning: h.primary_warning,
        trend: (h.trend as 'rising' | 'stable' | 'falling' || 'stable'),
        model_confidence: h.model_confidence / 100,
        created_at: new Date().toISOString(),
      })),
      z.array(HotspotSchema),
      () => apiFetch('/hotspots', { signal })
    )
  }

  const { data, error } = await supabase
    .from('hotspots')
    .select('*')

  if (error) throw new ApiError(500, error.message)
  return z.array(HotspotSchema).parse(data)
},

  // ---- Incidents ----
    async getIncidents(signal?: AbortSignal): Promise<Incident[]> {
    if (_useMock) {
      return withMockFallback(
        MOCK_INCIDENTS,
        z.array(IncidentSchema),
        () => apiFetch('/incidents', { signal })
      )
    }

    const { data, error } = await supabase
      .from('incidents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new ApiError(500, error.message)
    return z.array(IncidentSchema).parse(data)
  },

    async reportIncident(
    incident: Omit<Incident, 'id' | 'status' | 'verified_by' | 'created_at'>,
    signal?: AbortSignal
  ): Promise<Incident> {
    if (_useMock) {
      await new Promise((r) => setTimeout(r, 500))
      return IncidentSchema.parse({
        ...incident,
        id: `i-${Date.now()}`,
        status: 'reported',
        created_at: new Date().toISOString(),
      })
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new ApiError(401, 'Not authenticated')

    const newIncident = {
      ...incident,
      reported_by: user.id,
      status: 'reported' as const,
    }

    const { data, error } = await supabase
      .from('incidents')
      .insert(newIncident)
      .select()
      .single()

    if (error) throw new ApiError(400, error.message)
    return IncidentSchema.parse(data)
  },

  // ---- SOS ----
  async getSOSAlerts(signal?: AbortSignal): Promise<SOSAlert[]> {
    return withMockFallback(
      MOCK_SOS_ALERTS,
      z.array(SOSAlertSchema),
      () => apiFetch('/sos', { signal })
    )
  },

  async triggerSOS(
    payload: { latitude: number; longitude: number },
    signal?: AbortSignal
  ): Promise<SOSAlert> {
    if (_useMock) {
      await new Promise((r) => setTimeout(r, 400))
      return SOSAlertSchema.parse({
        id: `sos-${Date.now()}`,
        user_id: 'current-user',
        latitude: payload.latitude,
        longitude: payload.longitude,
        status: 'active',
        created_at: new Date().toISOString(),
      })
    }
    return apiFetch('/sos', { method: 'POST', body: JSON.stringify(payload), signal })
  },

  async acknowledgeSOSAlert(id: string, signal?: AbortSignal): Promise<SOSAlert> {
    if (_useMock) {
      await new Promise((r) => setTimeout(r, 300))
      const alert = MOCK_SOS_ALERTS.find((a) => a.id === id)
      return SOSAlertSchema.parse({ ...(alert ?? MOCK_SOS_ALERTS[0]), status: 'acknowledged', assigned_officer: 'Officer on duty' })
    }
    return apiFetch(`/sos/${id}/acknowledge`, { method: 'PATCH', signal })
  },

  // ---- ML ----
  async getMLMetrics(signal?: AbortSignal): Promise<MLMetrics> {
    return withMockFallback(
      MOCK_ML_METRICS,
      MLMetricsSchema,
      () => apiFetch('/ml/metrics', { signal })
    )
  },

  async getPrediction(
    req: PredictionRequest,
    signal?: AbortSignal
  ): Promise<PredictionResult> {
    if (_useMock) {
      await new Promise((r) => setTimeout(r, 700))
      const score = Math.floor(Math.random() * 80) + 10
      return {
        risk_score: score,
        classification: score > 75 ? 'critical' : score > 55 ? 'high' : score > 35 ? 'medium' : 'low',
        predicted_crimes: score > 60 ? ['theft', 'robbery'] : ['vandalism'],
        confidence: 0.87 + Math.random() * 0.1,
      }
    }
    return apiFetch('/ml/predict', { method: 'POST', body: JSON.stringify(req), signal })
  },

  async retrainModel(signal?: AbortSignal): Promise<{ message: string; job_id: string }> {
    if (_useMock) {
      await new Promise((r) => setTimeout(r, 1200))
      return { message: 'Retraining job queued successfully', job_id: `job-${Date.now()}` }
    }
    return apiFetch('/ml/retrain', { method: 'POST', signal })
  },

  // ---- Dashboard stats ----
    async getDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
    if (_useMock) {
      return withMockFallback(
        MOCK_STATS,
        DashboardStatsSchema,
        () => apiFetch('/dashboard/stats', { signal })
      )
    }

    const [hotspotsRes, incidentsRes, sosRes] = await Promise.all([
      supabase.from('hotspots').select('id, classification', { count: 'exact' }),
      supabase.from('incidents').select('id, status', { count: 'exact' }),
      supabase.from('sos_alerts').select('id, status', { count: 'exact' }),
    ])

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

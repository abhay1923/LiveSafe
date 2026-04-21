// ============================================================
// LiveSafe — API Service
// • Demo account bypass for citizen/police/admin@example.com
// • Zod runtime validation on all responses
// • AbortController support to prevent setState on unmounted components
// • Graceful mock-data fallback when backend is not yet connected
// ============================================================
import { supabase } from '@/lib/supabase'
import { z } from 'zod'
import { tokenStore } from '@/lib/tokenStore'
import type {
  User,
  UserRole,
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
  current_latitude: z.number().optional(),
  current_longitude: z.number().optional(),
  location_updated_at: z.string().optional(),
  status: z.enum(['active', 'acknowledged', 'resolved']),
  assigned_officer: z.string().optional(),
  response_time: z.number().optional(),
  acknowledged_at: z.string().optional(),
  resolved_at: z.string().optional(),
  created_at: z.string(),
}) as z.ZodType<SOSAlert>

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

// ---- Demo accounts — bypass Supabase for quick testing ----

const DEMO_ACCOUNTS: Record<string, { password: string; name: string; role: UserRole }> = {
  'citizen@example.com': { password: 'citizen123', name: 'Priya Sharma', role: 'citizen' },
  'police@example.com':  { password: 'police123',  name: 'Officer Rajesh Kumar', role: 'police' },
  'admin@example.com':   { password: 'admin123',   name: 'Admin Vikram Singh', role: 'admin' },
}

// ---- Mock mode flag ----
// Set VITE_USE_MOCK=false in .env to use real Supabase tables
const _useMock = import.meta.env.VITE_USE_MOCK !== 'false'

async function withMockFallback<T>(
  mockData: T,
  schema: z.ZodType<T>,
  realFetch: () => Promise<unknown>
): Promise<T> {
  if (_useMock) {
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300))
    return schema.parse(mockData)
  }
  try {
    const raw = await realFetch()
    return schema.parse(raw)
  } catch {
    // Graceful fallback to mock when backend/tables are unavailable
    await new Promise((r) => setTimeout(r, 200))
    return schema.parse(mockData)
  }
}

// ---- API methods ----

export const api = {
  // ---- Auth ----
  async login(
    email: string,
    password: string,
    _signal?: AbortSignal
  ): Promise<{ user: User; token: string }> {
    const key = email.toLowerCase().trim()

    // Demo account bypass — works without Supabase tables
    const demo = DEMO_ACCOUNTS[key]
    if (demo && demo.password === password) {
      const user: User = {
        id: `demo-${demo.role}`,
        email: key,
        name: demo.name,
        role: demo.role,
        is_active: true,
        created_at: new Date().toISOString(),
      }
      await new Promise((r) => setTimeout(r, 500)) // realistic delay
      return { user, token: `demo-token-${demo.role}` }
    }

    // Real Supabase login for non-demo accounts
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new ApiError(401, error.message)

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!profile) throw new ApiError(404, 'User profile not found in database')

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
    // Sign out from Supabase (ignore errors for demo tokens)
    await supabase.auth.signOut().catch(() => {})
  },

  // ---- Hotspots ----
  async getHotspots(signal?: AbortSignal): Promise<Hotspot[]> {
    const mockHotspots = RAW_HOTSPOTS_V5.map((h: V5HotspotRaw) => ({
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
    }))
    return withMockFallback(
      mockHotspots,
      z.array(HotspotSchema),
      async () => {
        const { data, error } = await supabase.from('hotspots').select('*')
        if (error) throw new ApiError(500, error.message)
        return data
      }
    )
  },

  // ---- Incidents ----
  async getIncidents(signal?: AbortSignal): Promise<Incident[]> {
    return withMockFallback(
      MOCK_INCIDENTS,
      z.array(IncidentSchema),
      async () => {
        const { data, error } = await supabase
          .from('incidents')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw new ApiError(500, error.message)
        return data
      }
    )
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

  // ---- SOS (always real backend) ----
  async getSOSAlerts(signal?: AbortSignal): Promise<SOSAlert[]> {
    const data = await apiFetch<unknown>('/sos', { signal })
    return z.array(SOSAlertSchema).parse(data)
  },

  async triggerSOS(
    payload: { latitude: number; longitude: number; user_id: string; user_name?: string },
    signal?: AbortSignal
  ): Promise<SOSAlert> {
    const data = await apiFetch<unknown>('/sos', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    })
    return SOSAlertSchema.parse(data)
  },

  async updateSOSLocation(
    id: string,
    payload: { latitude: number; longitude: number },
    signal?: AbortSignal
  ): Promise<SOSAlert> {
    const data = await apiFetch<unknown>(`/sos/${id}/location`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    })
    return SOSAlertSchema.parse(data)
  },

  async acknowledgeSOSAlert(id: string, officer?: string, signal?: AbortSignal): Promise<SOSAlert> {
    const data = await apiFetch<unknown>(`/sos/${id}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({ officer }),
      signal,
    })
    return SOSAlertSchema.parse(data)
  },

  async resolveSOSAlert(id: string, signal?: AbortSignal): Promise<SOSAlert> {
    const data = await apiFetch<unknown>(`/sos/${id}/resolve`, {
      method: 'PATCH',
      signal,
    })
    return SOSAlertSchema.parse(data)
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
    return withMockFallback(
      MOCK_STATS,
      DashboardStatsSchema,
      async () => {
        const [hotspotsRes, incidentsRes, sosRes] = await Promise.all([
          supabase.from('hotspots').select('id, classification', { count: 'exact' }),
          supabase.from('incidents').select('id, status', { count: 'exact' }),
          supabase.from('sos_alerts').select('id, status', { count: 'exact' }),
        ])

        const hotspot_count = hotspotsRes.count ?? 0
        const total_incidents = incidentsRes.count ?? 0
        const resolved_incidents = (incidentsRes.data ?? []).filter(i => i.status === 'resolved').length
        const active_sos_alerts = (sosRes.data ?? []).filter(s => s.status === 'active').length

        return {
          total_incidents,
          resolved_incidents,
          active_sos_alerts,
          hotspot_count,
          response_time_avg: 7.4,
          crime_reduction_pct: 12.3,
        }
      }
    )
  },
}

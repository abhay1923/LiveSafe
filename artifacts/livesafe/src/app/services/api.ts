// ============================================================
// LiveSafe — API Service
// • Zod runtime validation on all responses
// • AbortController support to prevent setState on unmounted components
// • Real backend data by default
// ============================================================
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
  'ipc_crime',
  'sll_crime',
  'crime_against_women',
  'crime_against_children',
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
  verified_by: z.string().nullable().optional(),
  created_at: z.string(),
})

const HotspotSchema: z.ZodType<Hotspot> = z.object({
  id: z.string(),
  city: z.string().optional(),
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

const LiveSignalSchema = z.object({
  id: z.string(),
  district: z.string(),
  state: z.string(),
  title: z.string(),
  snippet: z.string().nullable(),
  source_url: z.string(),
  source_domain: z.string(),
  provider: z.string(),
  verification_status: z.enum(['pending', 'verified', 'rejected']),
  verified_by: z.string().nullable(),
  verified_at: z.string().nullable(),
  retrieved_at: z.string(),
})

export type LiveSignal = z.infer<typeof LiveSignalSchema>

const DispatchStationSchema = z.object({
  id: z.number(),
  state: z.string(),
  police_district: z.string(),
  police_station: z.string(),
  landline: z.string().nullable(),
  mobile: z.string().nullable(),
  official_email: z.string().nullable(),
  station_address: z.string().nullable(),
  source_url: z.string(),
  verification_status: z.string(),
  notes: z.string().nullable(),
})

const DispatchViewSchema = z.object({
  alert: z.object({
    id: z.string(),
    user_name: z.string().nullable(),
    latitude: z.number(),
    longitude: z.number(),
    status: z.string(),
    created_at: z.string(),
  }),
  routing: z.object({
    status: z.enum(['routed', 'outside_coverage', 'district_not_in_directory', 'state_not_compiled']),
    nearest_district: z.object({ district: z.string(), state: z.string(), distance_km: z.number() }).nullable(),
    coverage: z.object({
      state: z.string(),
      official_portal: z.string(),
      coverage_status: z.string(),
      notes: z.string().nullable(),
    }).nullable(),
    stations: z.array(DispatchStationSchema),
    message: z.string(),
  }),
  dispatches: z.array(z.object({
    id: z.string(),
    station_id: z.string(),
    channel: z.enum(['call', 'email']),
    performed_by: z.string(),
    performed_at: z.string(),
  })),
})

export type DispatchView = z.infer<typeof DispatchViewSchema>
export type DispatchStation = DispatchView['routing']['stations'][number]

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
  whatsapp_notifications_sent: z.number().optional(),
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
  critical_hotspot_count: z.number().optional(),
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

// ---- API methods ----

export const api = {
  // ---- Auth (real backend) ----
  async login(
    email: string,
    password: string,
    signal?: AbortSignal
  ): Promise<{ user: User; token: string }> {
    const data = await apiFetch<{ user: unknown; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      signal,
    })
    return { user: UserSchema.parse(data.user), token: data.token }
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
    return apiFetch<AccessRequest[]>('/admin/access-requests', { signal })
  },

  async listUsers(signal?: AbortSignal): Promise<User[]> {
    const data = await apiFetch<unknown>('/admin/users', { signal })
    return z.array(UserSchema).parse(data)
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
    const data = await apiFetch<unknown>('/hotspots', { signal })
    return z.array(HotspotSchema).parse(data)
  },

  // ---- Incidents (real backend) ----
  async getIncidents(
    filters?: { type?: string; severity?: string; status?: string; from?: string; to?: string; limit?: number },
    signal?: AbortSignal
  ): Promise<Incident[]> {
    const qs = new URLSearchParams()
    if (filters?.type)     qs.set('type', filters.type)
    if (filters?.severity) qs.set('severity', filters.severity)
    if (filters?.status)   qs.set('status', filters.status)
    if (filters?.from)     qs.set('from', filters.from)
    if (filters?.to)       qs.set('to', filters.to)
    if (filters?.limit)    qs.set('limit', String(filters.limit))
    const url = `/incidents${qs.toString() ? '?' + qs.toString() : ''}`
    const data = await apiFetch<unknown>(url, { signal })
    return z.array(IncidentSchema).parse(data)
  },

  async getIncidentStats(signal?: AbortSignal): Promise<{
    total: number
    by_type: Array<{ type: string; count: number }>
    by_severity: Array<{ severity: string; count: number }>
    by_status: Array<{ status: string; count: number }>
    timeline_7d: Array<{ day: string; count: number; resolved?: number }>
    monthly_7m?: Array<{ month: string; count: number }>
    hourly_distribution?: Array<{ hour: number; count: number }>
  }> {
    return apiFetch('/incidents/stats', { signal })
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

  async getEmergencyContacts(signal?: AbortSignal): Promise<EmergencyContact[]> {
    const data = await apiFetch<unknown>('/sos/contacts', { signal })
    return z.array(EmergencyContactSchema).parse(data)
  },

  async addEmergencyContact(
    payload: { name: string; phone: string },
    signal?: AbortSignal
  ): Promise<EmergencyContact> {
    const data = await apiFetch<unknown>('/sos/contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    })
    return EmergencyContactSchema.parse(data)
  },

  async deleteEmergencyContact(id: string, signal?: AbortSignal): Promise<void> {
    await apiFetch(`/sos/contacts/${id}`, {
      method: 'DELETE',
      signal,
    })
  },

  // ---- Regional police dispatch (super admin) ----
  async getDispatch(sosId: string, signal?: AbortSignal): Promise<DispatchView> {
    const data = await apiFetch<unknown>(`/dispatch/sos/${sosId}`, { signal })
    return DispatchViewSchema.parse(data)
  },

  async logDispatch(sosId: string, stationId: string, channel: 'call' | 'email'): Promise<void> {
    await apiFetch(`/dispatch/sos/${sosId}/log`, {
      method: 'POST',
      body: JSON.stringify({ station_id: Number(stationId), channel }),
    })
  },

  // ---- Live public signals (TinyFish-discovered, human-reviewed) ----
  async getLiveSignals(status?: 'pending' | 'verified' | 'rejected', signal?: AbortSignal): Promise<LiveSignal[]> {
    const qs = status ? `?status=${status}` : ''
    const data = await apiFetch<unknown>(`/live-signals${qs}`, { signal })
    return z.array(LiveSignalSchema).parse(data)
  },

  async refreshLiveSignals(): Promise<{ districts_queried: number; signals_added: number; errors: Array<{ district: string; error: string }> }> {
    return apiFetch('/live-signals/refresh', { method: 'POST' })
  },

  async reviewLiveSignal(id: string, decision: 'verified' | 'rejected'): Promise<void> {
    await apiFetch(`/live-signals/${id}/review`, { method: 'PATCH', body: JSON.stringify({ decision }) })
  },

  // ---- ML (real backend) ----
  async getMLMetrics(signal?: AbortSignal): Promise<MLMetrics & {
    recent_30d_incidents?: number
    algorithm?: string
    cv_strategy?: string
    training_records?: number
    holdout_records?: number
    feature_count?: number
    holdout_r2?: number
    holdout_mae?: number
    train_r2?: number
    naive_persistence_baseline_r2?: number
    naive_persistence_baseline_accuracy?: number
    data_source?: string
    last_trained?: string
  }> {
    return apiFetch('/ml/metrics', { signal })
  },

  async getPublicStats(signal?: AbortSignal): Promise<{
    mapped_districts: number
    states_covered: number
    latest_data_year: number | null
  }> {
    return apiFetch('/public/stats', { signal })
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
    return apiFetch('/ml/predict', { method: 'POST', body: JSON.stringify(req), signal })
  },

  // ---- Dashboard stats ----
  async getDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
    const data = await apiFetch<unknown>('/dashboard/stats', { signal })
    return DashboardStatsSchema.parse(data)
  },
}

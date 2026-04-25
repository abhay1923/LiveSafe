import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Bell, MapPin, CheckCircle, Clock, User, AlertTriangle, RefreshCw, Radio, Navigation, ShieldAlert, Route, Activity, Mic, ShieldPlus, Footprints, HeartPulse, Users } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { api } from '@/app/services/api'
import { buildDispatchRecommendations, buildOperationalZones } from '@/app/services/safetyIntelligence'
import { useAuth } from '@/app/hooks/useAuth'
import type { Hotspot, Incident, SOSAlert, SOSStatus } from '@/types'

const STATUS_CONFIG: Record<SOSStatus, { label: string; color: string; bg: string }> = {
  active:       { label: 'Active',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  acknowledged: { label: 'Attending',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  resolved:     { label: 'Resolved',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
}

function formatRelative(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 5) return 'Just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function responderTone(status: string) {
  switch (status) {
    case 'en_route':
      return { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' }
    case 'accepted':
      return { bg: 'rgba(96,165,250,0.12)', color: '#93c5fd' }
    case 'standby':
      return { bg: 'rgba(250,204,21,0.12)', color: '#fde047' }
    default:
      return { bg: 'rgba(148,163,184,0.12)', color: '#cbd5e1' }
  }
}

function evidenceTone(status: string) {
  switch (status) {
    case 'flagged':
      return { bg: 'rgba(239,68,68,0.12)', color: '#fca5a5' }
    case 'reviewed':
      return { bg: 'rgba(34,197,94,0.12)', color: '#86efac' }
    default:
      return { bg: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }
  }
}

function AlertCard({
  alert,
  onAck,
  onResolve,
  onResponderUpdate,
  onEvidenceReview,
}: {
  alert: SOSAlert
  onAck: (id: string) => Promise<void>
  onResolve: (id: string) => Promise<void>
  onResponderUpdate: (alertId: string, responderId: string, status: NonNullable<SOSAlert['responder_status']>[number]['status']) => Promise<void>
  onEvidenceReview: (alertId: string, evidenceId: string, reviewStatus: NonNullable<SOSAlert['evidence_items']>[number]['review_status']) => Promise<void>
}) {
  const cfg = STATUS_CONFIG[alert.status]
  const [loading, setLoading] = useState<'ack' | 'resolve' | null>(null)
  const [busyResponderId, setBusyResponderId] = useState<string | null>(null)
  const [busyEvidenceId, setBusyEvidenceId] = useState<string | null>(null)

  const handleAck = async () => {
    setLoading('ack')
    try { await onAck(alert.id) } finally { setLoading(null) }
  }
  const handleResolve = async () => {
    setLoading('resolve')
    try { await onResolve(alert.id) } finally { setLoading(null) }
  }

  const liveLat = alert.current_latitude ?? alert.latitude
  const liveLon = alert.current_longitude ?? alert.longitude
  const hasMoved =
    alert.current_latitude !== undefined &&
    alert.current_longitude !== undefined &&
    (alert.current_latitude !== alert.latitude || alert.current_longitude !== alert.longitude)
  const locationFresh =
    alert.location_updated_at &&
    Date.now() - new Date(alert.location_updated_at).getTime() < 30000

  return (
    <div className={`alert-card ${alert.status === 'active' ? 'pulsing' : ''}`}>
      <div className="alert-header">
        <div className="alert-user">
          <div className="avatar">{(alert.user_name ?? '?').charAt(0).toUpperCase()}</div>
          <div>
            <div className="alert-name">{alert.user_name ?? 'Unknown User'}</div>
            <div className="alert-time"><Clock size={11} /> Triggered {formatRelative(alert.created_at)}</div>
          </div>
        </div>
        <div className="alert-status" style={{ background: cfg.bg, color: cfg.color }}>
          {cfg.label}
        </div>
      </div>

      <div className="alert-location">
        <MapPin size={13} color="#94a3b8" />
        <span>{liveLat.toFixed(5)}, {liveLon.toFixed(5)}</span>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${liveLat},${liveLon}`}
          target="_blank"
          rel="noopener noreferrer"
          className="map-link"
        >
          Open in Maps →
        </a>
      </div>

      {alert.status !== 'resolved' && (
        <div className={`live-row ${locationFresh ? 'live-on' : ''}`}>
          <Radio size={12} className={locationFresh ? 'pulse-dot' : ''} />
          <span>
            {locationFresh ? 'Live location sharing' : 'Location not updating'}
            {alert.location_updated_at && (
              <span className="live-time"> · updated {formatRelative(alert.location_updated_at)}</span>
            )}
          </span>
          {hasMoved && <span className="moved-tag">moved</span>}
        </div>
      )}

      {alert.assigned_officer && (
        <div className="alert-officer">
          <User size={12} color="#818cf8" />
          <span>Officer: <strong>{alert.assigned_officer}</strong></span>
        </div>
      )}

      {alert.response_time !== undefined && (
        <div className="alert-officer">
          <CheckCircle size={12} color="#22c55e" />
          <span>Response time: <strong>{Math.floor(alert.response_time / 60)}m {alert.response_time % 60}s</strong></span>
        </div>
      )}

      {alert.safety_mode && (
        <div className="alert-officer">
          <ShieldPlus size={12} color="#f472b6" />
          <span>Safety mode: <strong className="capitalize">{alert.safety_mode}</strong></span>
        </div>
      )}

      {alert.escalated && (
        <div className="escalation-banner">
          <ShieldAlert size={13} />
          Dead-man switch escalation triggered
        </div>
      )}

      {(alert.evidence_count ?? 0) > 0 && (
        <div className="alert-officer">
          <Mic size={12} color="#38bdf8" />
          <span>Evidence captured: <strong>{alert.evidence_count}</strong> clip(s)</span>
        </div>
      )}

      {alert.notified_targets && alert.notified_targets.length > 0 && (
        <div className="alert-tags">
          {alert.notified_targets.map((target) => (
            <span key={target} className="tag-chip">{target}</span>
          ))}
        </div>
      )}

      {alert.responder_status && alert.responder_status.length > 0 && (
        <div className="coord-box">
          <div className="coord-head">
            <Users size={12} />
            <span>Responder coordination</span>
          </div>
          <div className="coord-list">
            {alert.responder_status.map((responder) => {
              const tone = responderTone(responder.status)
              const nextStatus = responder.status === 'queued'
                ? 'notified'
                : responder.status === 'notified'
                  ? 'accepted'
                  : responder.status === 'accepted'
                    ? 'en_route'
                    : responder.status
              return (
                <div key={responder.id} className="coord-item">
                  <div>
                    <div className="coord-label">{responder.label}</div>
                    <div className="coord-meta">
                      {responder.role}
                      {typeof responder.eta_minutes === 'number' ? ` · ETA ${responder.eta_minutes} min` : ''}
                    </div>
                    {responder.status !== 'en_route' && responder.status !== 'standby' && (
                      <button
                        className="mini-action"
                        onClick={async () => {
                          setBusyResponderId(responder.id)
                          try { await onResponderUpdate(alert.id, responder.id, nextStatus) } finally { setBusyResponderId(null) }
                        }}
                        disabled={busyResponderId === responder.id}
                      >
                        {busyResponderId === responder.id ? 'Updating…' : `Mark ${nextStatus.replace('_', ' ')}`}
                      </button>
                    )}
                  </div>
                  <span className="coord-state" style={{ background: tone.bg, color: tone.color }}>
                    {responder.status.replace('_', ' ')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {alert.evidence_items && alert.evidence_items.length > 0 && (
        <div className="evidence-box">
          <div className="coord-head">
            <HeartPulse size={12} />
            <span>Evidence review</span>
          </div>
          <div className="coord-list">
            {alert.evidence_items.map((item) => {
              const tone = evidenceTone(item.review_status)
              const nextReviewState = item.review_status === 'new' ? 'flagged' : item.review_status === 'flagged' ? 'reviewed' : 'reviewed'
              return (
                <div key={item.id} className="coord-item">
                  <div>
                    <div className="coord-label">{item.label}</div>
                    <div className="coord-meta">
                      {item.type} · captured {formatRelative(item.captured_at)}
                    </div>
                    {item.review_status !== 'reviewed' && (
                      <button
                        className="mini-action"
                        onClick={async () => {
                          setBusyEvidenceId(item.id)
                          try { await onEvidenceReview(alert.id, item.id, nextReviewState) } finally { setBusyEvidenceId(null) }
                        }}
                        disabled={busyEvidenceId === item.id}
                      >
                        {busyEvidenceId === item.id ? 'Updating…' : `Mark ${nextReviewState}`}
                      </button>
                    )}
                  </div>
                  <span className="coord-state" style={{ background: tone.bg, color: tone.color }}>
                    {item.review_status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {alert.trail && alert.trail.length > 1 && (
        <div className="trail-box">
          <div className="trail-head">
            <Footprints size={12} />
            <span>Movement trail ({alert.trail.length} points)</span>
          </div>
          <div className="trail-points">
            {alert.trail.slice(-3).map((point, index) => (
              <div key={`${point.recorded_at}-${index}`} className="trail-point">
                {point.latitude.toFixed(4)}, {point.longitude.toFixed(4)}
              </div>
            ))}
          </div>
        </div>
      )}

      {alert.events && alert.events.length > 0 && (
        <div className="timeline-box">
          <div className="timeline-head">
            <Activity size={12} />
            <span>Incident timeline</span>
          </div>
          <div className="timeline-list">
            {[...alert.events].slice(-4).reverse().map((event) => (
              <div key={event.id} className="timeline-item">
                <div className="timeline-dot" />
                <div className="timeline-body">
                  <div className="timeline-detail">{event.detail}</div>
                  <div className="timeline-time">{formatRelative(event.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="alert-actions">
        {alert.status === 'active' && (
          <button className="btn-ack" onClick={handleAck} disabled={loading !== null}>
            {loading === 'ack' ? 'Acknowledging…' : '✓ Acknowledge & Attend'}
          </button>
        )}
        {alert.status === 'acknowledged' && (
          <button className="btn-resolve" onClick={handleResolve} disabled={loading !== null}>
            {loading === 'resolve' ? 'Resolving…' : '✓ Mark Resolved'}
          </button>
        )}
        {alert.status !== 'resolved' && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${liveLat},${liveLon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-nav"
          >
            <Navigation size={12} /> Navigate
          </a>
        )}
      </div>
    </div>
  )
}

export default function SOSAlertsPage() {
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<SOSAlert[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<SOSStatus>('active')
  const [, force] = useState(0)
  const fetchedOnce = useRef(false)

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await api.getSOSAlerts()
      setAlerts(data)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsLoading(false)
      fetchedOnce.current = true
    }
  }, [])

  // Initial fetch + polling every 4s
  useEffect(() => {
    fetchAlerts()
    const id = setInterval(fetchAlerts, 4000)
    return () => clearInterval(id)
  }, [fetchAlerts])

  useEffect(() => {
    api.getHotspots().then(setHotspots).catch(() => {})
    api.getIncidents({ limit: 20 }).then(setIncidents).catch(() => {})
  }, [])

  // Re-render every second to refresh "X seconds ago" timestamps
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const handleAck = async (id: string) => {
    const updated = await api.acknowledgeSOSAlert(id, user?.name)
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)))
  }

  const handleResolve = async (id: string) => {
    const updated = await api.resolveSOSAlert(id)
    setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)))
  }

  const handleResponderUpdate = async (
    alertId: string,
    responderId: string,
    status: NonNullable<SOSAlert['responder_status']>[number]['status']
  ) => {
    const updated = await api.updateSOSResponderStatus(alertId, responderId, status)
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)))
  }

  const handleEvidenceReview = async (
    alertId: string,
    evidenceId: string,
    reviewStatus: NonNullable<SOSAlert['evidence_items']>[number]['review_status']
  ) => {
    const updated = await api.updateSOSEvidenceReview(alertId, evidenceId, reviewStatus)
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)))
  }

  const counts = {
    active: alerts.filter((a) => a.status === 'active').length,
    acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
  }

  const filtered = alerts.filter((a) => a.status === tab)
  const dispatchRecommendations = useMemo(
    () => buildDispatchRecommendations(alerts, incidents, hotspots),
    [alerts, hotspots, incidents]
  )
  const priorityZones = useMemo(
    () => buildOperationalZones(incidents, hotspots, alerts),
    [alerts, hotspots, incidents]
  )
  const operationsSnapshot = useMemo(() => {
    const activeAlerts = alerts.filter((alert) => alert.status === 'active')
    const escalatedCount = activeAlerts.filter((alert) => alert.escalated).length
    const evidenceQueue = activeAlerts.reduce((sum, alert) => sum + (alert.evidence_count ?? 0), 0)
    const notifiedTargets = new Set(
      activeAlerts.flatMap((alert) => alert.notified_targets ?? [])
    )
    const engagedResponders = activeAlerts.reduce(
      (sum, alert) =>
        sum + (alert.responder_status?.filter((responder) => responder.status === 'accepted' || responder.status === 'en_route').length ?? 0),
      0
    )
    const flaggedEvidence = activeAlerts.reduce(
      (sum, alert) =>
        sum + (alert.evidence_items?.filter((item) => item.review_status === 'flagged').length ?? 0),
      0
    )
    const liveTrackingCount = activeAlerts.filter((alert) => {
      if (!alert.location_updated_at) return false
      return Date.now() - new Date(alert.location_updated_at).getTime() < 30000
    }).length

    return {
      escalatedCount,
      evidenceQueue,
      engagedResponders,
      flaggedEvidence,
      responderNetworkCount: notifiedTargets.size,
      liveTrackingCount,
    }
  }, [alerts])

  const TABS: { key: SOSStatus; label: string }[] = [
    { key: 'active', label: 'Current SOS' },
    { key: 'acknowledged', label: 'Attending' },
    { key: 'resolved', label: 'Resolved' },
  ]

  return (
    <AppLayout title="SOS Alerts" subtitle="Live emergency alerts — auto-refreshes every 4 seconds">
      <div className="sos-page">
        <div className="ops-grid">
          <div className="ops-card">
            <div className="ops-card-head">
              <div className="ops-title-wrap">
                <ShieldAlert size={17} color="#f87171" />
                <div>
                  <h3>Dispatch recommendations</h3>
                  <p>What the duty officer should do next</p>
                </div>
              </div>
            </div>
            <div className="ops-stack">
              {dispatchRecommendations.map((item) => (
                <div key={item.title} className={`ops-item ${item.severity}`}>
                  <div className="ops-item-title">{item.title}</div>
                  <div className="ops-item-detail">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ops-card">
            <div className="ops-card-head">
              <div className="ops-title-wrap">
                <Route size={17} color="#818cf8" />
                <div>
                  <h3>Priority corridors</h3>
                  <p>Where to stage units and visible patrols</p>
                </div>
              </div>
            </div>
            <div className="zone-stack">
              {priorityZones.map((zone) => (
                <div key={zone.label} className="zone-card">
                  <div className="zone-top">
                    <div>
                      <div className="zone-label">{zone.label}</div>
                      <div className="zone-note">{zone.recommendation}</div>
                    </div>
                    <div className="zone-score" style={{ color: STATUS_CONFIG[zone.risk === 'critical' ? 'active' : zone.risk === 'high' ? 'acknowledged' : 'resolved'].color }}>
                      {zone.priority}
                    </div>
                  </div>
                  <div className="zone-meta">
                    <span><Activity size={11} /> {zone.incidents} incidents</span>
                    <span><Bell size={11} /> {zone.activeAlerts} active SOS</span>
                    <span className={`zone-pill ${zone.risk}`}>{zone.risk}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="sos-header-stats">
          <div className="sos-stat active">
            <Bell size={20} color="#ef4444" />
            <div>
              <div className="sos-stat-val">{counts.active}</div>
              <div className="sos-stat-lbl">Active Alerts</div>
            </div>
          </div>
          <div className="sos-stat">
            <Radio size={20} color="#f59e0b" />
            <div>
              <div className="sos-stat-val">{counts.acknowledged}</div>
              <div className="sos-stat-lbl">Currently Attending</div>
            </div>
          </div>
          <div className="sos-stat">
            <CheckCircle size={20} color="#22c55e" />
            <div>
              <div className="sos-stat-val">{counts.resolved}</div>
              <div className="sos-stat-lbl">Resolved</div>
            </div>
          </div>
        </div>

        <div className="ops-snapshot-grid">
          <div className="snapshot-card">
            <div className="snapshot-label">Escalated alerts</div>
            <div className="snapshot-value">{operationsSnapshot.escalatedCount}</div>
            <div className="snapshot-note">Dead-man switch escalations needing priority cover</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-label">Live tracking active</div>
            <div className="snapshot-value">{operationsSnapshot.liveTrackingCount}</div>
            <div className="snapshot-note">Citizens still transmitting fresh movement updates</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-label">Evidence queue</div>
            <div className="snapshot-value">{operationsSnapshot.evidenceQueue}</div>
            <div className="snapshot-note">Audio/video clips waiting for review in active alerts</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-label">Response network</div>
            <div className="snapshot-value">{operationsSnapshot.responderNetworkCount}</div>
            <div className="snapshot-note">Distinct responder groups already pulled into the flow</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-label">Responders engaged</div>
            <div className="snapshot-value">{operationsSnapshot.engagedResponders}</div>
            <div className="snapshot-note">Volunteers, police, and standby teams that already accepted</div>
          </div>
          <div className="snapshot-card">
            <div className="snapshot-label">Flagged evidence</div>
            <div className="snapshot-value">{operationsSnapshot.flaggedEvidence}</div>
            <div className="snapshot-note">Clips that deserve immediate supervisor review</div>
          </div>
        </div>

        <div className="sos-filters">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`filter-btn ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`filter-badge ${t.key === 'active' ? 'badge-red' : ''}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
          <button className="btn btn-ghost refresh-btn" onClick={fetchAlerts}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {isLoading && !fetchedOnce.current && (
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading alerts…</span>
          </div>
        )}
        {error && (
          <div className="error-state">
            <AlertTriangle size={24} color="#ef4444" />
            <span>Failed to load alerts: {error}</span>
          </div>
        )}
        {fetchedOnce.current && filtered.length === 0 && (
          <div className="empty-state">
            <Bell size={40} color="#334155" />
            <p>No {tab === 'active' ? 'active' : tab === 'acknowledged' ? 'attending' : 'resolved'} alerts.</p>
          </div>
        )}
        <div className="alerts-grid">
          {filtered.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              onAck={handleAck}
              onResolve={handleResolve}
              onResponderUpdate={handleResponderUpdate}
              onEvidenceReview={handleEvidenceReview}
            />
          ))}
        </div>
      </div>

      <style>{`
        .sos-page { display: flex; flex-direction: column; gap: 1.25rem; }
        .ops-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }
        .ops-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 1rem;
        }
        .ops-card-head { margin-bottom: 0.8rem; }
        .ops-title-wrap { display: flex; align-items: center; gap: 0.7rem; }
        .ops-title-wrap h3 { margin: 0; font-size: 0.9rem; font-weight: 700; color: #f1f5f9; }
        .ops-title-wrap p { margin: 2px 0 0; font-size: 0.74rem; color: #64748b; }
        .ops-stack, .zone-stack { display: flex; flex-direction: column; gap: 0.7rem; }
        .ops-item {
          border-radius: 10px;
          padding: 0.8rem 0.9rem;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(15,23,42,0.55);
        }
        .ops-item.high { border-color: rgba(239,68,68,0.22); background: rgba(239,68,68,0.08); }
        .ops-item.medium { border-color: rgba(245,158,11,0.22); background: rgba(245,158,11,0.08); }
        .ops-item.low { border-color: rgba(99,102,241,0.22); background: rgba(99,102,241,0.08); }
        .ops-item-title { font-size: 0.8rem; font-weight: 700; color: #f1f5f9; }
        .ops-item-detail { margin-top: 0.25rem; font-size: 0.76rem; color: #cbd5e1; line-height: 1.5; }
        .zone-card {
          border-radius: 10px;
          padding: 0.8rem 0.9rem;
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(15,23,42,0.55);
        }
        .zone-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
        .zone-label { font-size: 0.82rem; font-weight: 700; color: #f1f5f9; }
        .zone-note { margin-top: 0.2rem; font-size: 0.74rem; color: #94a3b8; line-height: 1.45; }
        .zone-score { font-size: 1.3rem; font-weight: 800; line-height: 1; }
        .zone-meta { margin-top: 0.55rem; display: flex; flex-wrap: wrap; gap: 0.7rem; font-size: 0.72rem; color: #94a3b8; }
        .zone-meta span { display: inline-flex; align-items: center; gap: 4px; }
        .zone-pill {
          border-radius: 9999px;
          padding: 1px 8px;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .zone-pill.low { background: rgba(34,197,94,0.12); color: #22c55e; }
        .zone-pill.medium { background: rgba(234,179,8,0.12); color: #eab308; }
        .zone-pill.high { background: rgba(249,115,22,0.12); color: #f97316; }
        .zone-pill.critical { background: rgba(239,68,68,0.12); color: #ef4444; }
        .sos-header-stats { display: flex; gap: 1rem; flex-wrap: wrap; }
        .ops-snapshot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.9rem;
        }
        .snapshot-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 0.95rem 1rem;
        }
        .snapshot-label {
          font-size: 0.72rem;
          color: #94a3b8;
          text-transform: uppercase;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .snapshot-value {
          margin-top: 0.35rem;
          font-size: 1.5rem;
          line-height: 1;
          color: #f8fafc;
          font-weight: 800;
        }
        .snapshot-note {
          margin-top: 0.35rem;
          font-size: 0.72rem;
          line-height: 1.45;
          color: #64748b;
        }
        .sos-stat {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.85rem;
          flex: 1;
          min-width: 140px;
        }
        .sos-stat.active { border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.06); }
        .sos-stat-val { font-size: 1.6rem; font-weight: 800; color: #f1f5f9; line-height: 1; }
        .sos-stat-lbl { font-size: 0.73rem; color: #64748b; margin-top: 2px; }
        .sos-filters { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
        .filter-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0.4rem 0.9rem;
          border-radius: 7px;
          background: rgba(30,41,59,0.6);
          border: 1px solid rgba(255,255,255,0.07);
          color: #94a3b8;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 500;
          transition: all 0.15s;
        }
        .filter-btn:hover { background: rgba(255,255,255,0.05); color: #f1f5f9; }
        .filter-btn.active { background: rgba(99,102,241,0.15); border-color: rgba(129,140,248,0.4); color: #818cf8; font-weight: 600; }
        .filter-badge {
          background: rgba(255,255,255,0.1);
          color: #f1f5f9;
          border-radius: 9999px;
          padding: 0 6px;
          font-size: 0.68rem;
          font-weight: 700;
          min-width: 18px;
          text-align: center;
        }
        .filter-badge.badge-red { background: #ef4444; color: #fff; }
        .refresh-btn { margin-left: auto; }
        .alerts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }
        .alert-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          transition: border-color 0.2s;
        }
        .alert-card.pulsing {
          border-color: rgba(239,68,68,0.4);
          animation: alert-pulse 2.5s ease-in-out infinite;
        }
        @keyframes alert-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
          50%       { box-shadow: 0 0 0 6px rgba(239,68,68,0.1); }
        }
        .alert-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .alert-user { display: flex; align-items: center; gap: 0.65rem; }
        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(99,102,241,0.2);
          border: 1.5px solid rgba(129,140,248,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          color: #818cf8;
          flex-shrink: 0;
        }
        .alert-name { font-size: 0.88rem; font-weight: 600; color: #f1f5f9; }
        .alert-time { display: flex; align-items: center; gap: 3px; font-size: 0.72rem; color: #64748b; margin-top: 1px; }
        .alert-status {
          padding: 2px 10px;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-shrink: 0;
        }
        .alert-location {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          color: #94a3b8;
          flex-wrap: wrap;
        }
        .map-link { color: #818cf8; text-decoration: none; font-weight: 600; margin-left: auto; font-size: 0.75rem; }
        .map-link:hover { text-decoration: underline; }
        .live-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.74rem;
          color: #64748b;
          background: rgba(15,23,42,0.5);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 6px;
          padding: 5px 8px;
        }
        .live-row.live-on { color: #22c55e; border-color: rgba(34,197,94,0.25); background: rgba(34,197,94,0.06); }
        .live-time { color: #64748b; }
        .live-row.live-on .live-time { color: #94a3b8; }
        .pulse-dot { animation: live-pulse 1.4s ease-in-out infinite; }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .moved-tag {
          margin-left: auto;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          padding: 1px 6px;
          border-radius: 9999px;
          background: rgba(245,158,11,0.15);
          color: #f59e0b;
        }
        .alert-officer { display: flex; align-items: center; gap: 5px; font-size: 0.78rem; color: #94a3b8; }
        .alert-officer strong { color: #f1f5f9; }
        .escalation-banner {
          display:flex;
          align-items:center;
          gap:6px;
          background:rgba(239,68,68,0.12);
          border:1px solid rgba(239,68,68,0.25);
          color:#fecaca;
          border-radius:8px;
          padding:6px 8px;
          font-size:0.74rem;
          font-weight:700;
        }
        .alert-tags { display:flex; flex-wrap:wrap; gap:6px; }
        .tag-chip {
          background:rgba(99,102,241,0.12);
          color:#c7d2fe;
          border:1px solid rgba(129,140,248,0.2);
          border-radius:9999px;
          padding:2px 8px;
          font-size:0.68rem;
          font-weight:700;
        }
        .trail-box {
          background:rgba(15,23,42,0.5);
          border:1px solid rgba(255,255,255,0.05);
          border-radius:8px;
          padding:8px;
        }
        .coord-box, .evidence-box {
          background: rgba(15,23,42,0.5);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 8px;
        }
        .coord-head {
          display:flex;
          align-items:center;
          gap:5px;
          font-size:0.72rem;
          color:#94a3b8;
          font-weight:700;
        }
        .coord-list { margin-top: 8px; display:flex; flex-direction:column; gap:7px; }
        .coord-item {
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
          padding: 7px 8px;
          border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.04);
        }
        .coord-label { font-size: 0.73rem; color: #f1f5f9; font-weight: 600; }
        .coord-meta { margin-top: 2px; font-size: 0.68rem; color: #64748b; text-transform: capitalize; }
        .mini-action {
          margin-top: 6px;
          border: 1px solid rgba(129,140,248,0.25);
          background: rgba(99,102,241,0.12);
          color: #c7d2fe;
          border-radius: 9999px;
          padding: 3px 8px;
          font-size: 0.66rem;
          font-weight: 700;
          cursor: pointer;
        }
        .mini-action:hover:not(:disabled) { background: rgba(99,102,241,0.2); }
        .mini-action:disabled { opacity: 0.65; cursor: wait; }
        .coord-state {
          border-radius: 9999px;
          padding: 2px 8px;
          font-size: 0.66rem;
          font-weight: 700;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .trail-head {
          display:flex;
          align-items:center;
          gap:5px;
          font-size:0.72rem;
          color:#94a3b8;
          font-weight:700;
        }
        .trail-points { margin-top:6px; display:flex; flex-direction:column; gap:4px; }
        .trail-point { font-size:0.72rem; color:#cbd5e1; }
        .timeline-box {
          background: rgba(15,23,42,0.55);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 8px;
        }
        .timeline-head {
          display:flex;
          align-items:center;
          gap:5px;
          font-size:0.72rem;
          color:#94a3b8;
          font-weight:700;
        }
        .timeline-list { margin-top: 8px; display:flex; flex-direction:column; gap:8px; }
        .timeline-item { display:flex; gap:8px; align-items:flex-start; }
        .timeline-dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: #818cf8;
          margin-top: 5px;
          flex-shrink: 0;
          box-shadow: 0 0 0 3px rgba(129,140,248,0.12);
        }
        .timeline-body { min-width: 0; }
        .timeline-detail { font-size: 0.73rem; color: #e2e8f0; line-height: 1.45; }
        .timeline-time { margin-top: 2px; font-size: 0.68rem; color: #64748b; }
        .alert-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem; }
        .btn-ack, .btn-resolve, .btn-nav {
          font-size: 0.8rem;
          padding: 0.45rem 0.85rem;
          border-radius: 7px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          text-decoration: none;
        }
        .btn-ack { background: #ef4444; color: #fff; }
        .btn-ack:hover:not(:disabled) { background: #dc2626; }
        .btn-resolve { background: #22c55e; color: #fff; }
        .btn-resolve:hover:not(:disabled) { background: #16a34a; }
        .btn-nav { background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid rgba(129,140,248,0.3); }
        .btn-nav:hover { background: rgba(99,102,241,0.25); }
        .btn-ack:disabled, .btn-resolve:disabled { opacity: 0.6; cursor: not-allowed; }
        .loading-state, .error-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3rem;
          color: #64748b;
          font-size: 0.9rem;
        }
        .empty-state p { margin: 0; }
      `}</style>
    </AppLayout>
  )
}

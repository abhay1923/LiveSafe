import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Bell, MapPin, CheckCircle, Clock, User, AlertTriangle, RefreshCw, Radio, Navigation } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { api } from '@/app/services/api'
import { useAuth } from '@/app/hooks/useAuth'
import type { SOSAlert, SOSStatus } from '@/types'

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

function AlertCard({
  alert,
  onAck,
  onResolve,
}: {
  alert: SOSAlert
  onAck: (id: string) => Promise<void>
  onResolve: (id: string) => Promise<void>
}) {
  const cfg = STATUS_CONFIG[alert.status]
  const [loading, setLoading] = useState<'ack' | 'resolve' | null>(null)

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

  const counts = {
    active: alerts.filter((a) => a.status === 'active').length,
    acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
  }

  const filtered = alerts.filter((a) => a.status === tab)

  const TABS: { key: SOSStatus; label: string }[] = [
    { key: 'active', label: 'Current SOS' },
    { key: 'acknowledged', label: 'Attending' },
    { key: 'resolved', label: 'Resolved' },
  ]

  return (
    <AppLayout title="SOS Alerts" subtitle="Live emergency alerts — auto-refreshes every 4 seconds">
      <div className="sos-page">
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
            <AlertCard key={a.id} alert={a} onAck={handleAck} onResolve={handleResolve} />
          ))}
        </div>
      </div>

      <style>{`
        .sos-page { display: flex; flex-direction: column; gap: 1.25rem; }
        .sos-header-stats { display: flex; gap: 1rem; flex-wrap: wrap; }
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

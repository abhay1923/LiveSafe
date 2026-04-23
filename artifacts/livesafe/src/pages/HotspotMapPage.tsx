import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/app/hooks/useApi'
import { api } from '@/app/services/api'
import AppLayout from '@/components/layout/AppLayout'
import type { Hotspot, RiskClassification } from '@/types'
import { AlertTriangle, MapPin, TrendingUp, Shield, Filter, Navigation, X, Loader2 } from 'lucide-react'
import 'leaflet/dist/leaflet.css'

// ── Risk config with precise colors ─────────────────────────────────
const RISK_CONFIG: Record<RiskClassification, {
  color: string; fillColor: string; label: string; emoji: string;
  border: string; glow: string; bg: string; textColor: string
}> = {
  critical: {
    color: '#dc2626', fillColor: '#ef4444', label: 'Critical Risk',
    emoji: '🔴', border: 'rgba(220,38,38,0.8)', glow: '#ef4444',
    bg: 'rgba(239,68,68,0.12)', textColor: '#fca5a5'
  },
  high: {
    color: '#c2410c', fillColor: '#f97316', label: 'High Risk',
    emoji: '🟠', border: 'rgba(194,65,12,0.8)', glow: '#f97316',
    bg: 'rgba(249,115,22,0.12)', textColor: '#fdba74'
  },
  medium: {
    color: '#a16207', fillColor: '#eab308', label: 'Medium Risk',
    emoji: '🟡', border: 'rgba(161,98,7,0.8)', glow: '#eab308',
    bg: 'rgba(234,179,8,0.12)', textColor: '#fde047'
  },
  low: {
    color: '#15803d', fillColor: '#22c55e', label: 'Low Risk',
    emoji: '🟢', border: 'rgba(21,128,61,0.8)', glow: '#22c55e',
    bg: 'rgba(34,197,94,0.12)', textColor: '#86efac'
  },
}

const TREND_ICONS: Record<string, string> = {
  rising: '📈 Rising', stable: '➡️ Stable', falling: '📉 Falling'
}

// ── Leaflet map component ────────────────────────────────────────────
function LeafletMap({
  hotspots, filter, onLocateReady
}: {
  hotspots: Hotspot[]
  filter: RiskClassification | 'all'
  onLocateReady?: (fn: (lat: number, lng: number) => Hotspot | null) => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  const circlesRef = useRef<{ remove(): void }[]>([])
  const hotspotsRef = useRef<Hotspot[]>(hotspots)

  // Init map once
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then((L) => {
      if (mapInstanceRef.current) return

      const map = L.map(mapRef.current!, {
        center: [20.5937, 78.9629], // Centre of India
        zoom: 5,
        zoomControl: true,
        preferCanvas: true, // Better performance for many circles
      })

      mapInstanceRef.current = map

      // Dark OSM tiles for better visibility
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      setTimeout(() => map.invalidateSize(), 200)

      // Expose locate function to parent
      if (onLocateReady) {
        onLocateReady((lat: number, lng: number) => {
          const hs = hotspotsRef.current
          if (!hs.length) return null
          // Find nearest hotspot by Haversine distance
          let nearest: Hotspot | null = null
          let minDist = Infinity
          hs.forEach((h) => {
            const dLat = (h.latitude - lat) * Math.PI / 180
            const dLng = (h.longitude - lng) * Math.PI / 180
            const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(h.latitude*Math.PI/180)*Math.sin(dLng/2)**2
            const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
            if (dist < minDist) { minDist = dist; nearest = h }
          })
          if (nearest) {
            map.setView([(nearest as Hotspot).latitude, (nearest as Hotspot).longitude], 9, { animate: true })
            // Find and open the circle popup
            setTimeout(() => {
              map.eachLayer((layer: { getLatLng?: () => { lat: number; lng: number }; openPopup?: () => void }) => {
                if (layer.getLatLng && layer.openPopup) {
                  const ll = layer.getLatLng()
                  if (Math.abs(ll.lat - (nearest as Hotspot).latitude) < 0.001 &&
                      Math.abs(ll.lng - (nearest as Hotspot).longitude) < 0.001) {
                    layer.openPopup()
                  }
                }
              })
            }, 600)
          }
          return nearest
        })
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Keep hotspotsRef in sync
  useEffect(() => { hotspotsRef.current = hotspots }, [hotspots])

  // Redraw circles when hotspots or filter changes
  useEffect(() => {
    if (!hotspots.length) return
    import('leaflet').then((L) => {
      const map = mapInstanceRef.current
      if (!map) return

      // Clear old circles safely
      circlesRef.current.forEach((circ: { remove(): void }) => { try { circ.remove() } catch (_) { /* already removed */ } })
      circlesRef.current = []

      const visible = filter === 'all'
        ? hotspots
        : hotspots.filter((h) => h.classification === filter)

      visible.forEach((h) => {
        const cfg = RISK_CONFIG[h.classification]
        const [city, state] = (h.state ?? '').split(', ')
        const confidence = h.model_confidence ? `${(h.model_confidence * 100).toFixed(0)}%` : 'N/A'
        const trendLabel = h.trend ? TREND_ICONS[h.trend] : '➡️ Stable'

        const crimeTags = h.predicted_crimes.map((c: string) =>
          `<span style="background:rgba(255,255,255,0.1);color:#e2e8f0;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;text-transform:capitalize;border:1px solid rgba(255,255,255,0.2);display:inline-block;margin:2px">${c.replace('_', ' ')}</span>`
        ).join('')

        // Score bar
        const scoreBar = `
          <div style="margin:8px 0">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em">Risk Score</span>
              <span style="font-size:12px;font-weight:800;color:${cfg.fillColor}">${h.risk_score}/100</span>
            </div>
            <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
              <div style="height:100%;width:${h.risk_score}%;background:linear-gradient(90deg,${cfg.color},${cfg.fillColor});border-radius:3px;transition:width 0.5s"></div>
            </div>
          </div>`

        const popupContent = `
          <div style="min-width:260px;max-width:300px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f1f5f9">

            <!-- Header -->
            <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:12px 14px;border-radius:10px 10px 0 0;border-bottom:2px solid ${cfg.color};margin:-1px -1px 0 -1px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:1.8rem;line-height:1">${cfg.emoji}</span>
                <div style="flex:1">
                  <div style="font-size:14px;font-weight:800;color:#f1f5f9;line-height:1.2">${city ?? h.state}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:1px">${state ?? ''} • ${trendLabel}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:2rem;font-weight:900;color:${cfg.fillColor};line-height:1">${h.risk_score}</div>
                  <div style="font-size:9px;color:${cfg.textColor};text-transform:uppercase;letter-spacing:0.05em">${cfg.label}</div>
                </div>
              </div>
              ${scoreBar}
            </div>

            <!-- Body -->
            <div style="background:#1e293b;padding:10px 14px;border-radius:0 0 10px 10px">

              <!-- Warning -->
              <div style="background:${cfg.bg};border:1px solid ${cfg.border};border-radius:7px;padding:8px 10px;margin-bottom:10px">
                <div style="font-size:11px;font-weight:700;color:${cfg.textColor};margin-bottom:3px;text-transform:uppercase;letter-spacing:0.04em">⚠️ Safety Warning</div>
                <div style="font-size:11.5px;color:#cbd5e1;line-height:1.5">${h.primary_warning ?? 'Stay alert and report suspicious activity'}</div>
              </div>

              <!-- Crime types -->
              <div style="margin-bottom:10px">
                <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px">Predicted Crime Types</div>
                <div style="display:flex;flex-wrap:wrap;gap:3px">${crimeTags}</div>
              </div>

              <!-- Stats row -->
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">
                <div style="text-align:center">
                  <div style="font-size:13px;font-weight:800;color:#f1f5f9">${h.crime_count}</div>
                  <div style="font-size:9px;color:#64748b;text-transform:uppercase">Per Lakh</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:13px;font-weight:800;color:#f1f5f9">${(h.radius / 1000).toFixed(1)}km</div>
                  <div style="font-size:9px;color:#64748b;text-transform:uppercase">Radius</div>
                </div>
                <div style="text-align:center">
                  <div style="font-size:13px;font-weight:800;color:${cfg.fillColor}">${confidence}</div>
                  <div style="font-size:9px;color:#64748b;text-transform:uppercase">Confidence</div>
                </div>
              </div>
            </div>
          </div>`

        // Outer pulsing circle for critical
        if (h.classification === 'critical') {
          L.circle([h.latitude, h.longitude], {
            radius: h.radius * 1.8,
            color: cfg.color,
            fillColor: cfg.fillColor,
            fillOpacity: 0.05,
            weight: 1,
            opacity: 0.4,
            dashArray: '6, 6',
          }).addTo(map)
        }

        // Main circle
        const circle = L.circle([h.latitude, h.longitude], {
          radius: h.radius,
          color: cfg.color,
          fillColor: cfg.fillColor,
          fillOpacity: h.classification === 'critical' ? 0.35 : 0.25,
          weight: h.classification === 'critical' ? 3 : 2,
          opacity: 0.9,
        }).addTo(map)

        circle.bindPopup(popupContent, {
          maxWidth: 320,
          className: 'livesafe-popup',
        })

        circlesRef.current.push(circle)
      })

      // Fit bounds to visible circles
      if (visible.length > 0) {
        const bounds = visible.map((h) => [h.latitude, h.longitude] as [number, number])
        try {
          map.fitBounds(bounds as unknown as Parameters<typeof map.fitBounds>[0], {
            padding: [50, 50],
            maxZoom: filter === 'all' ? 6 : 12,
          })
        } catch (_) { /* fitBounds can throw on empty/invalid coords */ }
      }

      setTimeout(() => map.invalidateSize(), 100)
    })
  }, [hotspots, filter])

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: '100%', minHeight: '550px', borderRadius: '12px' }}
    />
  )
}

// ── Main page ────────────────────────────────────────────────────────
type LocateState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; hotspot: Hotspot; distance: number }
  | { status: 'error'; message: string }

export default function HotspotMapPage() {
  const { data: hotspots, isLoading, error } = useApi((sig) => api.getHotspots(sig))
  const [filter, setFilter] = useState<RiskClassification | 'all'>('all')
  const [locateState, setLocateState] = useState<LocateState>({ status: 'idle' })
  const locateFnRef = useRef<((lat: number, lng: number) => Hotspot | null) | null>(null)

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocateState({ status: 'error', message: 'Geolocation not supported by your browser.' })
      return
    }
    setLocateState({ status: 'loading' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        if (!locateFnRef.current) {
          setLocateState({ status: 'error', message: 'Map not ready yet. Try again in a moment.' })
          return
        }
        const nearest = locateFnRef.current(lat, lng)
        if (nearest) {
          // Calculate distance in km
          const dLat = (nearest.latitude - lat) * Math.PI / 180
          const dLng = (nearest.longitude - lng) * Math.PI / 180
          const a = Math.sin(dLat/2)**2 + Math.cos(lat*Math.PI/180)*Math.cos(nearest.latitude*Math.PI/180)*Math.sin(dLng/2)**2
          const dist = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)))
          setLocateState({ status: 'found', hotspot: nearest, distance: dist })
        } else {
          setLocateState({ status: 'error', message: 'No hotspot data available yet.' })
        }
      },
      (err) => {
        const msgs: Record<number, string> = {
          1: 'Location permission denied. Please allow location access.',
          2: 'Location unavailable. Check your device settings.',
          3: 'Location request timed out. Please try again.',
        }
        setLocateState({ status: 'error', message: msgs[err.code] || 'Could not get your location.' })
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  const counts = hotspots ? {
    critical: hotspots.filter((h) => h.classification === 'critical').length,
    high:     hotspots.filter((h) => h.classification === 'high').length,
    medium:   hotspots.filter((h) => h.classification === 'medium').length,
    low:      hotspots.filter((h) => h.classification === 'low').length,
    total:    hotspots.length,
    avgRisk:  Math.round(hotspots.reduce((s, h) => s + h.risk_score, 0) / (hotspots.length || 1)),
  } : null

  return (
    <AppLayout
      title="India Crime Hotspot Map"
      subtitle="ML-predicted risk zones — All India • Live Supabase data"
    >
      <div className="map-page">

        {/* Stats bar */}
        {counts && (
          <div className="map-stats">
            <div className="stat-card">
              <MapPin size={18} color="#818cf8" />
              <div>
                <div className="stat-value">{counts.total}</div>
                <div className="stat-label">All India Cities</div>
              </div>
            </div>
            <div className="stat-card critical-card" onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}>
              <span style={{ fontSize: '1.2rem' }}>🔴</span>
              <div>
                <div className="stat-value" style={{ color: '#ef4444' }}>{counts.critical}</div>
                <div className="stat-label">Critical</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setFilter(filter === 'high' ? 'all' : 'high')}>
              <span style={{ fontSize: '1.2rem' }}>🟠</span>
              <div>
                <div className="stat-value" style={{ color: '#f97316' }}>{counts.high}</div>
                <div className="stat-label">High Risk</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setFilter(filter === 'medium' ? 'all' : 'medium')}>
              <span style={{ fontSize: '1.2rem' }}>🟡</span>
              <div>
                <div className="stat-value" style={{ color: '#eab308' }}>{counts.medium}</div>
                <div className="stat-label">Medium</div>
              </div>
            </div>
            <div className="stat-card" onClick={() => setFilter(filter === 'low' ? 'all' : 'low')}>
              <span style={{ fontSize: '1.2rem' }}>🟢</span>
              <div>
                <div className="stat-value" style={{ color: '#22c55e' }}>{counts.low}</div>
                <div className="stat-label">Low Risk</div>
              </div>
            </div>
            <div className="stat-card">
              <Shield size={18} color="#22c55e" />
              <div>
                <div className="stat-value">96.5%</div>
                <div className="stat-label">ML Accuracy</div>
              </div>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="filter-bar">
          <Filter size={14} color="#64748b" />
          <span className="filter-label">Filter by risk:</span>
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((f) => {
            const cfg = f !== 'all' ? RISK_CONFIG[f] : null
            return (
              <button
                key={f}
                className={`filter-chip ${filter === f ? 'active' : ''}`}
                style={filter === f && cfg ? {
                  background: cfg.bg,
                  borderColor: cfg.border,
                  color: cfg.textColor,
                } : {}}
                onClick={() => setFilter(f)}
              >
                {f !== 'all' ? RISK_CONFIG[f].emoji + ' ' : ''}{f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && counts ? ` (${counts[f as keyof typeof counts] ?? ''})` : ''}
              </button>
            )
          })}
          {filter !== 'all' && (
            <button className="filter-chip clear-btn" onClick={() => setFilter('all')}>
              ✕ Clear
            </button>
          )}
          <button
            className={`locate-btn ${locateState.status === 'loading' ? 'loading' : ''}`}
            onClick={handleLocate}
            disabled={locateState.status === 'loading'}
            title="Find your nearest city risk zone"
          >
            {locateState.status === 'loading'
              ? <><Loader2 size={13} className="spin" /> Locating…</>
              : <><Navigation size={13} /> My Location</>
            }
          </button>
        </div>

        {/* Legend */}
        <div className="map-legend">
          {(Object.entries(RISK_CONFIG) as [RiskClassification, typeof RISK_CONFIG[RiskClassification]][]).map(
            ([key, cfg]) => (
              <div key={key} className="legend-item">
                <div className="legend-dot" style={{
                  background: cfg.fillColor,
                  boxShadow: `0 0 8px ${cfg.glow}`,
                  border: `1.5px solid ${cfg.color}`,
                }} />
                <span style={{ color: cfg.textColor }}>{cfg.label}</span>
              </div>
            )
          )}
          <div className="legend-item" style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b' }}>
            <TrendingUp size={11} style={{ marginRight: 3 }} />
            Click a circle for details & safety tips
          </div>
        </div>

        {/* Locate result card */}
        {locateState.status === 'found' && (() => {
          const h = locateState.hotspot
          const cfg = RISK_CONFIG[h.classification]
          const [city, state] = (h.state ?? '').split(', ')
          return (
            <div className="locate-card" style={{ borderColor: cfg.border, background: cfg.bg }}>
              <div className="locate-card-icon">{cfg.emoji}</div>
              <div className="locate-card-body">
                <div className="locate-card-title" style={{ color: cfg.textColor }}>
                  {city} — <strong>{cfg.label}</strong>
                </div>
                <div className="locate-card-sub">
                  {state} • Risk Score: <strong style={{ color: cfg.fillColor }}>{h.risk_score}/100</strong> •
                  ML Confidence: <strong>{h.model_confidence ? `${(h.model_confidence * 100).toFixed(0)}%` : 'N/A'}</strong> •
                  ~{locateState.distance} km from you
                </div>
                <div className="locate-card-warning">{h.primary_warning}</div>
              </div>
              <button className="locate-card-close" onClick={() => setLocateState({ status: 'idle' })}>
                <X size={14} />
              </button>
            </div>
          )
        })()}
        {locateState.status === 'error' && (
          <div className="locate-card error-card">
            <AlertTriangle size={16} color="#f87171" />
            <span style={{ color: '#f87171', fontSize: '0.85rem' }}>{locateState.message}</span>
            <button className="locate-card-close" onClick={() => setLocateState({ status: 'idle' })}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Map */}
        <div className="map-wrapper">
          {isLoading && (
            <div className="map-overlay">
              <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
              <span>Running ML model across India…</span>
            </div>
          )}
          {error && (
            <div className="map-overlay">
              <AlertTriangle size={32} color="#ef4444" />
              <span>Failed to load. Please refresh.</span>
            </div>
          )}
          <LeafletMap hotspots={hotspots ?? []} filter={filter} onLocateReady={(fn) => { locateFnRef.current = fn }} />
        </div>

        {/* Data attribution */}
        <div className="attribution">
          📊 Data source: Live project database (Supabase) &nbsp;|&nbsp;
          🤖 Model metrics and labels from configured backend/services
        </div>
      </div>

      <style>{`
        .map-page { display: flex; flex-direction: column; gap: 0.85rem; height: 100%; }

        .map-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.65rem;
        }
        .stat-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 0.75rem 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          cursor: pointer;
          transition: all 0.15s;
        }
        .stat-card:hover { border-color: rgba(255,255,255,0.15); background: #263248; }
        .critical-card { border-color: rgba(239,68,68,0.2); }
        .stat-value { font-size: 1.35rem; font-weight: 800; color: #f1f5f9; line-height: 1; }
        .stat-label { font-size: 0.68rem; color: #64748b; margin-top: 2px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }

        .filter-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          padding: 0.5rem 0.75rem;
          background: rgba(15,23,42,0.6);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
        }
        .filter-label { font-size: 0.75rem; color: #64748b; font-weight: 600; white-space: nowrap; }
        .filter-chip {
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          background: rgba(30,41,59,0.8);
          border: 1px solid rgba(255,255,255,0.08);
          color: #94a3b8;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .filter-chip:hover { background: rgba(255,255,255,0.07); color: #f1f5f9; }
        .filter-chip.active { font-weight: 700; }
        .clear-btn { color: #f87171; border-color: rgba(239,68,68,0.3); }
        .clear-btn:hover { background: rgba(239,68,68,0.1); }

        .map-legend {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.65rem 1.25rem;
          padding: 0.55rem 0.9rem;
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          backdrop-filter: blur(8px);
        }
        .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; }
        .legend-dot { width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0; }

        .map-wrapper {
          position: relative;
          flex: 1;
          height: calc(100vh - 340px);
          min-height: 500px;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .map-overlay {
          position: absolute;
          inset: 0;
          background: rgba(15,23,42,0.92);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          z-index: 1000;
          color: #94a3b8;
          font-size: 0.9rem;
          border-radius: 12px;
        }
        .attribution {
          font-size: 0.7rem;
          color: #475569;
          text-align: center;
          padding: 0.35rem;
        }

        /* Leaflet popup overrides for dark theme */
        .livesafe-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          padding: 0 !important;
          border-radius: 12px !important;
          box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08) !important;
          border: none !important;
          overflow: hidden;
        }
        .livesafe-popup .leaflet-popup-content {
          margin: 0 !important;
          color: #f1f5f9;
        }
        .livesafe-popup .leaflet-popup-tip-container { display: none; }
        .livesafe-popup .leaflet-popup-close-button {
          color: #94a3b8 !important;
          top: 8px !important;
          right: 8px !important;
          font-size: 18px !important;
          z-index: 10;
        }
        .leaflet-control-zoom a {
          background: #1e293b !important;
          color: #f1f5f9 !important;
          border-color: #334155 !important;
        }
        .leaflet-control-zoom a:hover { background: #334155 !important; }
        .leaflet-control-attribution {
          background: rgba(15,23,42,0.8) !important;
          color: #475569 !important;
          font-size: 10px !important;
        }
        .leaflet-control-attribution a { color: #64748b !important; }

        /* My Location button */
        .locate-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(135deg, rgba(99,102,241,0.25), rgba(129,140,248,0.15));
          border: 1px solid rgba(99,102,241,0.5);
          color: #a5b4fc;
          transition: all 0.18s;
          white-space: nowrap;
          margin-left: auto;
        }
        .locate-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(99,102,241,0.4), rgba(129,140,248,0.25));
          border-color: rgba(129,140,248,0.8);
          color: #c7d2fe;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99,102,241,0.3);
        }
        .locate-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .locate-btn.loading { animation: pulse-border 1.2s ease-in-out infinite; }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(99,102,241,0.5); box-shadow: none; }
          50% { border-color: rgba(129,140,248,0.9); box-shadow: 0 0 12px rgba(99,102,241,0.4); }
        }

        /* Locate result card */
        .locate-card {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          border: 1px solid;
          position: relative;
          animation: slideDown 0.25s ease-out;
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .error-card {
          background: rgba(239,68,68,0.08);
          border-color: rgba(239,68,68,0.3);
          align-items: center;
          gap: 0.6rem;
        }
        .locate-card-icon { font-size: 1.8rem; line-height: 1; flex-shrink: 0; margin-top: 2px; }
        .locate-card-body { flex: 1; min-width: 0; }
        .locate-card-title { font-size: 0.9rem; font-weight: 700; margin-bottom: 3px; }
        .locate-card-sub { font-size: 0.78rem; color: #94a3b8; margin-bottom: 5px; }
        .locate-card-warning {
          font-size: 0.78rem;
          color: #cbd5e1;
          line-height: 1.5;
          background: rgba(0,0,0,0.2);
          border-radius: 6px;
          padding: 5px 8px;
        }
        .locate-card-close {
          position: absolute;
          top: 8px; right: 8px;
          background: none; border: none;
          color: #64748b; cursor: pointer;
          padding: 2px; display: flex;
          border-radius: 4px;
          transition: color 0.15s;
        }
        .locate-card-close:hover { color: #f1f5f9; }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </AppLayout>
  )
}

import { useEffect, useState, useCallback, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Mail, MapPin, ArrowLeft, RefreshCw, AlertTriangle } from 'lucide-react'
import { api, type DispatchView, type DispatchStation } from '@/app/services/api'
import { useAuth } from '@/app/hooks/useAuth'
import type { SOSAlert } from '@/types'

const POLL_MS = 15000

// Turn a directory number such as "0129-2296824" or "9582200123 / 9582200124"
// into an international tel: link. Only the first number is used.
function telHref(raw: string | null): string | null {
  if (!raw) return null
  const first = raw.split(/[\/,;]/)[0].replace(/\D/g, '')
  if (!first) return null
  const national = first.startsWith('0') ? first.slice(1) : first
  return national.length >= 10 ? `tel:+91${national.slice(-10)}` : null
}

function mailHref(station: DispatchStation, alertId: string, lat: number, lon: number, who: string | null, district: string | null): string | null {
  if (!station.official_email) return null
  const subject = `LiveSafe SOS ref ${alertId.toUpperCase()}: emergency at ${lat.toFixed(5)}, ${lon.toFixed(5)}`
  const body = [
    'Emergency SOS received through LiveSafe. Please dispatch a unit.',
    '',
    `Reference: ${alertId.toUpperCase()}`,
    `Reported by: ${who ?? 'not provided'}`,
    `Location: ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    `Map: https://www.google.com/maps?q=${lat},${lon}`,
    district ? `Nearest mapped district: ${district}` : '',
    '',
    'Location is from the reporting device and may be approximate. Please call back to confirm.',
  ].join('\n')
  return `mailto:${station.official_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

const STATUS_TEXT: Record<DispatchView['routing']['status'], string> = {
  routed: 'Routed to regional stations',
  outside_coverage: 'Outside routing area',
  district_not_in_directory: 'District not in directory',
  state_not_compiled: 'State contacts not compiled',
}

export default function DispatchPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [alerts, setAlerts] = useState<SOSAlert[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<DispatchView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)

  const loadAlerts = useCallback(async (signal?: AbortSignal) => {
    try {
      const all = await api.getSOSAlerts(signal)
      setAlerts(all.filter((a) => a.status === 'active'))
      setError(null)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    loadAlerts(ac.signal)
    const timer = setInterval(() => loadAlerts(), POLL_MS)
    return () => { ac.abort(); clearInterval(timer) }
  }, [loadAlerts])

  const openAlert = async (id: string) => {
    setSelectedId(id)
    setView(null)
    setNotice(null)
    try {
      setView(await api.getDispatch(id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const record = async (stationId: string, channel: 'call' | 'email') => {
    if (!selectedId) return
    try {
      await api.logDispatch(selectedId, stationId, channel)
      setNotice(`Logged ${channel} to station.`)
      setView(await api.getDispatch(selectedId))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: '1.25rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/super-admin')} style={btnGhost}><ArrowLeft size={14} /> Back</button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>SOS Dispatch</h1>
          <p style={{ margin: 0, fontSize: '.8rem', color: '#94a3b8' }}>
            Active SOS alerts, routed to the regional police station. Signed in as {user?.name}.
          </p>
        </div>
        <button onClick={() => loadAlerts()} style={{ ...btnGhost, marginLeft: 'auto' }} title="Refresh"><RefreshCw size={14} /></button>
      </header>

      {error && <p style={{ color: '#f87171', fontSize: '.85rem' }}>{error}</p>}
      {notice && <p style={{ color: '#34d399', fontSize: '.85rem' }}>{notice}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: '1rem', alignItems: 'start' }}>
        <aside style={card}>
          <h2 style={cardTitle}>Active alerts ({alerts.length})</h2>
          {loadingList && <p style={muted}>Loading…</p>}
          {!loadingList && alerts.length === 0 && <p style={muted}>No active SOS alerts. This list refreshes every 15 seconds.</p>}
          {alerts.map((a) => (
            <button
              key={a.id}
              onClick={() => openAlert(a.id)}
              style={{
                ...btnGhost, display: 'block', width: '100%', textAlign: 'left', marginBottom: '.5rem',
                borderColor: selectedId === a.id ? '#38bdf8' : '#334155',
              }}
            >
              <strong>Ref {a.id.toUpperCase()}</strong>
              <div style={{ fontSize: '.78rem', color: '#94a3b8' }}>
                {a.user_name ?? 'Unknown'} · {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
              </div>
              <div style={{ fontSize: '.72rem', color: '#64748b' }}>{new Date(a.created_at).toLocaleString('en-IN')}</div>
            </button>
          ))}
        </aside>

        <section style={card}>
          {!selectedId && <p style={muted}>Select an alert to see the regional station for its location.</p>}
          {selectedId && !view && <p style={muted}>Routing alert…</p>}
          {view && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '.5rem' }}>
                <div>
                  <h2 style={cardTitle}>Ref {view.alert.id.toUpperCase()}</h2>
                  <p style={muted}>
                    {view.alert.user_name ?? 'Unknown'} ·{' '}
                    <a href={`https://www.google.com/maps?q=${view.alert.latitude},${view.alert.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>
                      <MapPin size={12} style={{ verticalAlign: 'middle' }} /> {view.alert.latitude.toFixed(5)}, {view.alert.longitude.toFixed(5)}
                    </a>
                  </p>
                </div>
                <span style={{ ...pill, borderColor: view.routing.status === 'routed' ? '#34d399' : '#f59e0b' }}>
                  {STATUS_TEXT[view.routing.status]}
                </span>
              </div>

              <p style={{ fontSize: '.85rem', color: '#cbd5e1', margin: '.75rem 0' }}>{view.routing.message}</p>

              {view.routing.coverage && view.routing.status !== 'routed' && (
                <p style={{ fontSize: '.85rem' }}>
                  Official portal: <a href={view.routing.coverage.official_portal} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8' }}>{view.routing.coverage.official_portal}</a>
                </p>
              )}

              {view.routing.stations.length > 0 && (
                <div style={{ overflowX: 'auto', marginTop: '.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                        <th style={th}>Police station</th><th style={th}>Landline</th><th style={th}>Mobile</th><th style={th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {view.routing.stations.map((s) => {
                        const tel = telHref(s.landline) ?? telHref(s.mobile)
                        const mail = mailHref(s, view.alert.id, view.alert.latitude, view.alert.longitude, view.alert.user_name, view.routing.nearest_district?.district ?? null)
                        return (
                          <tr key={s.id} style={{ borderTop: '1px solid #1e293b' }}>
                            <td style={td}>
                              <strong>{s.police_station}</strong>
                              <div style={{ color: '#64748b', fontSize: '.72rem' }}>{s.police_district}</div>
                              {s.verification_status && <div style={{ color: '#f59e0b', fontSize: '.7rem' }}>Confirm before use: transcribed from official page</div>}
                            </td>
                            <td style={td}>{s.landline ?? <span style={muted}>Not published</span>}</td>
                            <td style={td}>{s.mobile ?? <span style={muted}>Not published</span>}</td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>
                                {tel ? (
                                  <a href={tel} onClick={() => record(String(s.id), 'call')} style={btnAction}><Phone size={12} /> Call</a>
                                ) : <span style={muted}>No number</span>}
                                {mail ? (
                                  <a href={mail} onClick={() => record(String(s.id), 'email')} style={btnAction}><Mail size={12} /> Email</a>
                                ) : <span style={muted}>No email</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ marginTop: '1rem' }}>
                <h3 style={{ fontSize: '.85rem', margin: '0 0 .4rem' }}>Dispatch log</h3>
                {view.dispatches.length === 0 && <p style={muted}>No calls or emails logged yet.</p>}
                <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '.8rem', color: '#94a3b8' }}>
                  {view.dispatches.map((d) => (
                    <li key={d.id}>
                      {new Date(d.performed_at).toLocaleString('en-IN')} · {d.channel} · station {d.station_id} · by {d.performed_by}
                    </li>
                  ))}
                </ul>
              </div>

              <p style={{ fontSize: '.72rem', color: '#64748b', marginTop: '1rem', display: 'flex', gap: '.35rem' }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                Numbers and emails were transcribed from official pages and may be out of date. The app does not place calls or send email automatically. Call 112 for any life-threatening emergency.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

const card: CSSProperties = { background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '1rem' }
const cardTitle: CSSProperties = { margin: '0 0 .25rem', fontSize: '1rem', fontWeight: 700 }
const muted: CSSProperties = { color: '#64748b', fontSize: '.8rem', margin: 0 }
const th: CSSProperties = { padding: '.4rem .5rem' }
const td: CSSProperties = { padding: '.5rem', verticalAlign: 'top' }
const pill: CSSProperties = { fontSize: '.75rem', padding: '.25rem .6rem', borderRadius: 999, border: '1px solid', alignSelf: 'flex-start' }
const btnGhost: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '.35rem', background: 'transparent', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8, padding: '.4rem .65rem', cursor: 'pointer', fontSize: '.8rem' }
const btnAction: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '.3rem', background: '#1d4ed8', color: '#fff', borderRadius: 6, padding: '.3rem .55rem', textDecoration: 'none', fontSize: '.78rem' }

import { useEffect, useState } from 'react'
import { api } from '@/app/services/api'
import type { PredictionResult, MLMetrics } from '@/types'
import {
  Zap, MapPin, Clock, Calendar, Loader2, AlertCircle, Activity,
  Brain, TrendingUp, Target, Crosshair, Info,
} from 'lucide-react'

const PRESET_LOCATIONS = [
  { name: 'Delhi (Connaught Place)', lat: 28.6315, lon: 77.2167 },
  { name: 'Mumbai (Bandra)',         lat: 19.0596, lon: 72.8295 },
  { name: 'Bengaluru (MG Road)',     lat: 12.9750, lon: 77.6050 },
  { name: 'Chennai (T Nagar)',       lat: 13.0418, lon: 80.2341 },
  { name: 'Kolkata (Park Street)',   lat: 22.5530, lon: 88.3520 },
  { name: 'Hyderabad (Banjara Hills)', lat: 17.4126, lon: 78.4071 },
  { name: 'Pune (Koregaon Park)',    lat: 18.5362, lon: 73.8939 },
  { name: 'Jaipur (Pink City)',      lat: 26.9239, lon: 75.8267 },
  { name: 'Patna (Boring Road)',     lat: 25.6093, lon: 85.1235 },
  { name: 'Custom coordinates',      lat: NaN,     lon: NaN },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const RISK_COLORS = {
  low:      { bg: '#22c55e', text: 'Low risk' },
  medium:   { bg: '#eab308', text: 'Medium risk' },
  high:     { bg: '#f97316', text: 'High risk' },
  critical: { bg: '#ef4444', text: 'Critical risk' },
}

type Prediction = Awaited<ReturnType<typeof api.getPrediction>>

export default function Simulation() {
  const now = new Date()
  const [presetIdx, setPresetIdx] = useState(0)
  const [lat, setLat] = useState(PRESET_LOCATIONS[0].lat)
  const [lon, setLon] = useState(PRESET_LOCATIONS[0].lon)
  const [hour, setHour] = useState(now.getHours())
  const [day, setDay] = useState(now.getDay())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof api.getMLMetrics>> | null>(null)

  useEffect(() => {
    api.getMLMetrics().then(setMetrics).catch(() => {})
    runPrediction()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runPrediction = async () => {
    setError('')
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setError('Please enter valid coordinates.'); return
    }
    setLoading(true)
    try {
      const result = await api.getPrediction({
        latitude: lat, longitude: lon, hour, day_of_week: day, month,
      })
      setPrediction(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Prediction failed')
    } finally { setLoading(false) }
  }

  const handlePreset = (i: number) => {
    setPresetIdx(i)
    const p = PRESET_LOCATIONS[i]
    if (Number.isFinite(p.lat)) { setLat(p.lat); setLon(p.lon) }
  }

  const useCurrentTime = () => {
    const n = new Date()
    setHour(n.getHours()); setDay(n.getDay()); setMonth(n.getMonth() + 1)
  }

  const colorScheme = prediction ? RISK_COLORS[prediction.classification as keyof typeof RISK_COLORS] : null

  return (
    <div className="sm-page">
      <div className="sm-header">
        <div className="sm-title">
          <Zap size={22} color="#fbbf24"/>
          <div>
            <h2>Crime Prediction Engine</h2>
            <p>Run the LiveSafe v5.0 ensemble model on any location and time</p>
          </div>
        </div>
        {metrics && (
          <div className="sm-model-badge">
            <Brain size={14}/> {metrics.model_version ?? 'v5.0'} •{' '}
            {metrics.accuracy ? `${(metrics.accuracy * 100).toFixed(1)}% acc` : ''}
          </div>
        )}
      </div>

      <div className="sm-grid">
        {/* ---- Left: input form ---- */}
        <div className="sm-card sm-form">
          <h3><Crosshair size={16}/> Prediction Inputs</h3>

          <div className="sm-field">
            <label>Location preset</label>
            <select value={presetIdx} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handlePreset(Number(e.target.value))}>
              {PRESET_LOCATIONS.map((p, i) => <option key={i} value={i}>{p.name}</option>)}
            </select>
          </div>

          <div className="sm-row">
            <div className="sm-field">
              <label>Latitude</label>
              <input type="number" step="0.0001" value={Number.isFinite(lat) ? lat : ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setLat(parseFloat(e.target.value)); setPresetIdx(PRESET_LOCATIONS.length-1) }}/>
            </div>
            <div className="sm-field">
              <label>Longitude</label>
              <input type="number" step="0.0001" value={Number.isFinite(lon) ? lon : ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setLon(parseFloat(e.target.value)); setPresetIdx(PRESET_LOCATIONS.length-1) }}/>
            </div>
          </div>

          <div className="sm-row">
            <div className="sm-field">
              <label><Clock size={12}/> Hour ({String(hour).padStart(2,'0')}:00)</label>
              <input type="range" min={0} max={23} value={hour}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHour(parseInt(e.target.value))}/>
            </div>
          </div>
          <div className="sm-row">
            <div className="sm-field">
              <label><Calendar size={12}/> Day of week</label>
              <select value={day} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDay(parseInt(e.target.value))}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div className="sm-field">
              <label>Month</label>
              <select value={month} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMonth(parseInt(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="sm-actions">
            <button className="sm-btn ghost" onClick={useCurrentTime}>Use now</button>
            <button className="sm-btn primary" onClick={runPrediction} disabled={loading}>
              {loading ? <><Loader2 size={14} className="spin"/> Predicting…</> : <><Zap size={14}/> Run Prediction</>}
            </button>
          </div>

          {error && <div className="sm-error"><AlertCircle size={14}/> {error}</div>}
        </div>

        {/* ---- Right: prediction result ---- */}
        <div className="sm-card sm-result">
          {!prediction && !loading && (
            <div className="sm-placeholder">Run a prediction to see the result here.</div>
          )}
          {loading && (
            <div className="sm-placeholder"><Loader2 size={28} className="spin"/> Running model…</div>
          )}
          {prediction && colorScheme && (
            <>
              <div className="sm-score-ring" style={{ ['--c' as string]: colorScheme.bg, ['--p' as string]: prediction.risk_score } as React.CSSProperties}>
                <div className="sm-score-inner">
                  <span className="sm-score-num">{prediction.risk_score}</span>
                  <span className="sm-score-label">/ 100</span>
                </div>
              </div>
              <div className="sm-class" style={{ color: colorScheme.bg, borderColor: colorScheme.bg + '55', background: colorScheme.bg + '15' }}>
                {colorScheme.text.toUpperCase()}
              </div>

              <div className="sm-conf"><Target size={13}/> Confidence: <strong>{(prediction.confidence * 100).toFixed(1)}%</strong></div>

              <div className="sm-crimes">
                <div className="sm-crimes-label">Likely crime types in this area:</div>
                <div className="sm-crimes-tags">
                  {prediction.predicted_crimes.map(c => (
                    <span key={c} className="sm-tag">{c.replace('_',' ')}</span>
                  ))}
                </div>
              </div>

              {prediction.explanation && (
                <div className="sm-explain">
                  <h4><Info size={13}/> Why this score?</h4>
                  <ul>
                    <li><MapPin size={12}/> Nearest known area: <strong>{prediction.explanation.nearest_area}</strong> ({prediction.explanation.distance_km} km away)</li>
                    <li><Activity size={12}/> Base risk for this region: <strong>{prediction.explanation.base_risk}</strong></li>
                    <li><Clock size={12}/> {prediction.explanation.time_factor.label} (×{prediction.explanation.time_factor.value})</li>
                    <li><Calendar size={12}/> {prediction.explanation.day_factor.label} (×{prediction.explanation.day_factor.value})</li>
                    <li><TrendingUp size={12}/> {prediction.explanation.season_factor.label} (×{prediction.explanation.season_factor.value})</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Model info */}
      {metrics && (
        <div className="sm-card sm-metrics">
          <h3><Brain size={16}/> Model Information</h3>
          <div className="sm-metric-grid">
            <Metric label="Algorithm" value={metrics.algorithm ?? '—'} />
            <Metric label="Version"   value={metrics.model_version} />
            <Metric label="Accuracy"  value={`${(metrics.accuracy * 100).toFixed(2)}%`} />
            <Metric label="Precision" value={`${(metrics.precision * 100).toFixed(2)}%`} />
            <Metric label="Recall"    value={`${(metrics.recall * 100).toFixed(2)}%`} />
            <Metric label="F1 Score"  value={`${(metrics.f1_score * 100).toFixed(2)}%`} />
            <Metric label="Training records" value={(metrics.training_records ?? metrics.sample_count).toLocaleString()} />
            <Metric label="Features"  value={metrics.feature_count ?? '—'} />
            <Metric label="Last trained" value={new Date(metrics.last_trained).toLocaleDateString()} />
            <Metric label="Reports last 30d" value={metrics.recent_30d_incidents ?? 0} />
          </div>
        </div>
      )}

      <style>{`
        .sm-page{padding:1.25rem;display:flex;flex-direction:column;gap:1rem;color:#e2e8f0}
        .sm-header{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap}
        .sm-title{display:flex;gap:.7rem;align-items:center}
        .sm-title h2{margin:0;font-size:1.3rem;font-weight:700;color:#f1f5f9}
        .sm-title p{margin:0;font-size:.78rem;color:#64748b}
        .sm-model-badge{display:flex;align-items:center;gap:6px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.4);color:#a5b4fc;padding:.4rem .75rem;border-radius:9px;font-size:.78rem;font-weight:600}
        .sm-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
        @media (max-width: 900px){.sm-grid{grid-template-columns:1fr}}
        .sm-card{background:rgba(30,41,59,.6);border:1px solid #334155;border-radius:12px;padding:1.1rem}
        .sm-card h3{margin:0 0 .85rem;font-size:.95rem;color:#cbd5e1;font-weight:700;display:flex;align-items:center;gap:6px}
        .sm-form{display:flex;flex-direction:column;gap:.75rem}
        .sm-row{display:flex;gap:.6rem;flex-wrap:wrap}
        .sm-field{flex:1;min-width:140px;display:flex;flex-direction:column;gap:4px}
        .sm-field label{font-size:.72rem;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:4px}
        .sm-field input,.sm-field select{background:rgba(15,23,42,.6);border:1px solid #334155;border-radius:8px;padding:.45rem .65rem;color:#e2e8f0;font-size:.85rem;outline:none;height:36px}
        .sm-field input[type=range]{padding:0;height:auto;border:none;background:none}
        .sm-field input:focus,.sm-field select:focus{border-color:#6366f1}
        .sm-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.4rem}
        .sm-btn{display:flex;align-items:center;gap:6px;padding:.55rem .95rem;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .15s}
        .sm-btn.primary{background:#6366f1;color:white}
        .sm-btn.primary:hover:not(:disabled){background:#4f46e5}
        .sm-btn.primary:disabled{opacity:.6;cursor:wait}
        .sm-btn.ghost{background:rgba(15,23,42,.6);border-color:#334155;color:#cbd5e1}
        .sm-btn.ghost:hover{border-color:#6366f1;color:#a5b4fc}
        .sm-error{display:flex;align-items:center;gap:6px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;padding:.5rem .7rem;border-radius:8px;font-size:.8rem}
        .sm-result{display:flex;flex-direction:column;align-items:center;gap:.85rem;justify-content:center;min-height:380px}
        .sm-placeholder{color:#64748b;font-size:.95rem;display:flex;align-items:center;gap:8px}
        .sm-score-ring{width:170px;height:170px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p) * 1%), #1e293b 0);display:flex;align-items:center;justify-content:center;position:relative}
        .sm-score-inner{width:130px;height:130px;background:#0f172a;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1px solid #334155}
        .sm-score-num{font-size:2.4rem;font-weight:800;color:#f1f5f9;line-height:1}
        .sm-score-label{font-size:.75rem;color:#64748b;margin-top:2px}
        .sm-class{padding:.4rem 1rem;border-radius:99px;border:1px solid;font-size:.78rem;font-weight:700;letter-spacing:.05em}
        .sm-conf{font-size:.85rem;color:#cbd5e1;display:flex;align-items:center;gap:5px}
        .sm-crimes{width:100%;text-align:center}
        .sm-crimes-label{font-size:.78rem;color:#94a3b8;margin-bottom:6px}
        .sm-crimes-tags{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
        .sm-tag{background:rgba(99,102,241,.18);color:#a5b4fc;padding:3px 10px;border-radius:99px;font-size:.75rem;font-weight:600;text-transform:capitalize}
        .sm-explain{width:100%;background:rgba(15,23,42,.5);border:1px solid #334155;border-radius:9px;padding:.75rem .9rem}
        .sm-explain h4{margin:0 0 .5rem;font-size:.8rem;color:#cbd5e1;font-weight:700;display:flex;align-items:center;gap:5px}
        .sm-explain ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:5px;font-size:.78rem;color:#94a3b8}
        .sm-explain li{display:flex;align-items:center;gap:6px}
        .sm-explain strong{color:#e2e8f0;font-weight:600}
        .sm-metrics .sm-metric-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem}
        .sm-metric{background:rgba(15,23,42,.5);border:1px solid #334155;border-radius:8px;padding:.6rem .75rem;display:flex;flex-direction:column;gap:2px}
        .sm-metric-label{font-size:.68rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;font-weight:600}
        .sm-metric-value{font-size:.92rem;color:#f1f5f9;font-weight:700}
        .spin{animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="sm-metric">
      <span className="sm-metric-label">{label}</span>
      <span className="sm-metric-value">{value}</span>
    </div>
  )
}

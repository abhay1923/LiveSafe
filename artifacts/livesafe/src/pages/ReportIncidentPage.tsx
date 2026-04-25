import React from 'react'
import { useState, type FormEvent } from 'react'
import { AlertTriangle, MapPin, CheckCircle, Loader2, Info } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import { api } from '@/app/services/api'
import { useAuth } from '@/app/hooks/useAuth'
import type { CrimeType, SeverityLevel } from '@/types'

const CRIME_TYPES: { value: CrimeType; label: string; emoji: string }[] = [
  { value: 'theft',     label: 'Theft / Pickpocketing', emoji: '👜' },
  { value: 'robbery',   label: 'Robbery / Snatching',   emoji: '⚠️' },
  { value: 'assault',   label: 'Physical Assault',       emoji: '🥊' },
  { value: 'harassment',label: 'Harassment',             emoji: '🚨' },
  { value: 'vandalism', label: 'Vandalism',              emoji: '🔨' },
  { value: 'burglary',  label: 'Burglary / Break-in',   emoji: '🏠' },
  { value: 'fraud',     label: 'Fraud / Scam',          emoji: '💳' },
  { value: 'other',     label: 'Other',                  emoji: '📋' },
]

const SEVERITIES: { value: SeverityLevel; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: '#22c55e' },
  { value: 'medium',   label: 'Medium',   color: '#eab308' },
  { value: 'high',     label: 'High',     color: '#f97316' },
  { value: 'critical', label: 'Critical', color: '#ef4444' },
]

export default function ReportIncidentPage() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    type: '' as CrimeType | '',
    description: '',
    latitude: '',
    longitude: '',
    severity: 'medium' as SeverityLevel,
  })
  const [locLoading, setLocLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const getLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f: typeof form) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }))
        setLocLoading(false)
      },
      () => {
        setError('Unable to retrieve your location. Please enter coordinates manually.')
        setLocLoading(false)
      }
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.type) { setError('Please select an incident type.'); return }
    if (!form.description.trim()) { setError('Please describe the incident.'); return }
    if (!form.latitude || !form.longitude) { setError('Please provide a location.'); return }

    setError('')
    setSubmitting(true)
    try {
      await api.reportIncident({
        type: form.type,
        description: form.description.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        severity: form.severity,
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <AppLayout title="Report Incident" subtitle="Help keep Delhi NCR safe">
        <div className="success-screen animate-fade-in">
          <div className="success-icon">
            <CheckCircle size={48} color="#22c55e" />
          </div>
          <h2>Incident Reported Successfully</h2>
          <p>
            Your report has been submitted and will be reviewed by our team.
            Thank you for making Delhi NCR safer.
          </p>
          <div className="success-id">
            Reference ID: <strong>INC-{Date.now().toString(36).toUpperCase()}</strong>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setSubmitted(false); setForm({ type: '', description: '', latitude: '', longitude: '', severity: 'medium' }) }}
          >
            Report Another Incident
          </button>
        </div>
        <style>{`
          .success-screen {
            max-width: 480px;
            margin: 4rem auto;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
          }
          .success-icon {
            width: 80px;
            height: 80px;
            background: rgba(34,197,94,0.1);
            border: 2px solid rgba(34,197,94,0.3);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .success-screen h2 { margin: 0; font-size: 1.4rem; color: #f1f5f9; }
          .success-screen p { color: #94a3b8; line-height: 1.6; margin: 0; }
          .success-id {
            background: #1e293b;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 8px;
            padding: 0.6rem 1.2rem;
            font-size: 0.85rem;
            color: #64748b;
          }
          .success-id strong { color: #818cf8; }
        `}</style>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Report Incident" subtitle="Help keep Delhi NCR safe">
      <div className="report-page">
        <div className="report-info">
          <Info size={16} color="#818cf8" />
          <span>Reports are reviewed within 2 hours. For emergencies, use the SOS button or call 112.</span>
        </div>

        <form onSubmit={handleSubmit} className="report-form" noValidate>
          {error && (
            <div className="form-error">
              <AlertTriangle size={15} />
              {error}
            </div>
          )}

          {/* Incident type */}
          <div className="form-section">
            <label className="form-label">Incident Type *</label>
            <div className="crime-grid">
              {CRIME_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  type="button"
                  className={`crime-card ${form.type === ct.value ? 'selected' : ''}`}
                  onClick={() => setForm((f: typeof form) => ({ ...f, type: ct.value }))}
                >
                  <span className="crime-emoji">{ct.emoji}</span>
                  <span className="crime-label">{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="form-section">
            <label htmlFor="desc" className="form-label">Description *</label>
            <textarea
              id="desc"
              rows={4}
              placeholder="Describe what happened, when, and any details that might help police..."
              value={form.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((f: typeof form) => ({ ...f, description: e.target.value }))}
              maxLength={1000}
            />
            <div className="char-count">{form.description.length}/1000</div>
          </div>

          {/* Severity */}
          <div className="form-section">
            <label className="form-label">Severity</label>
            <div className="severity-row">
              {SEVERITIES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`severity-btn ${form.severity === s.value ? 'selected' : ''}`}
                  style={form.severity === s.value ? { borderColor: s.color, color: s.color, background: s.color + '18' } : {}}
                  onClick={() => setForm((f: typeof form) => ({ ...f, severity: s.value }))}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="form-section">
            <label className="form-label">Location *</label>
            <div className="loc-row">
              <input
                type="number"
                step="any"
                placeholder="Latitude"
                value={form.latitude}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f: typeof form) => ({ ...f, latitude: e.target.value }))}
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude"
                value={form.longitude}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((f: typeof form) => ({ ...f, longitude: e.target.value }))}
              />
              <button type="button" className="btn btn-ghost" onClick={getLocation} disabled={locLoading}>
                {locLoading ? <Loader2 size={15} className="spin" /> : <MapPin size={15} />}
                {locLoading ? 'Getting…' : 'Use My Location'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary submit-btn" disabled={submitting}>
            {submitting ? <><Loader2 size={16} className="spin" /> Submitting…</> : <><AlertTriangle size={16} /> Submit Report</>}
          </button>
        </form>
      </div>

      <style>{`
        .report-page { max-width: 680px; display: flex; flex-direction: column; gap: 1.25rem; }
        .report-info {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(99,102,241,0.1);
          border: 1px solid rgba(129,140,248,0.2);
          border-radius: 8px;
          padding: 0.65rem 0.9rem;
          font-size: 0.82rem;
          color: #94a3b8;
        }
        .report-form {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 14px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .form-error {
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 8px;
          padding: 0.6rem 0.85rem;
          color: #f87171;
          font-size: 0.82rem;
        }
        .form-section { display: flex; flex-direction: column; gap: 0.6rem; }
        .form-label { font-size: 0.82rem; font-weight: 600; color: #94a3b8; letter-spacing: 0.02em; }
        .crime-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 0.5rem;
        }
        .crime-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 0.75rem;
          background: rgba(15,23,42,0.5);
          border: 1.5px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          color: #94a3b8;
          font-size: 0.8rem;
          font-weight: 500;
          text-align: center;
        }
        .crime-card:hover { border-color: rgba(99,102,241,0.4); color: #f1f5f9; background: rgba(99,102,241,0.08); }
        .crime-card.selected { border-color: #6366f1; color: #818cf8; background: rgba(99,102,241,0.15); }
        .crime-emoji { font-size: 1.4rem; }
        .crime-label { line-height: 1.3; }
        textarea {
          background: rgba(15,23,42,0.6);
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 0.65rem 0.9rem;
          color: #f1f5f9;
          font-size: 0.88rem;
          resize: vertical;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
          line-height: 1.5;
        }
        textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        .char-count { font-size: 0.72rem; color: #475569; text-align: right; }
        .severity-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .severity-btn {
          padding: 0.45rem 1rem;
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(15,23,42,0.5);
          color: #94a3b8;
          cursor: pointer;
          font-size: 0.83rem;
          font-weight: 600;
          transition: all 0.15s;
        }
        .severity-btn:hover { border-color: rgba(255,255,255,0.2); color: #f1f5f9; }
        .loc-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .loc-row input {
          flex: 1;
          min-width: 120px;
          background: rgba(15,23,42,0.6);
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 0.6rem 0.8rem;
          color: #f1f5f9;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .loc-row input:focus { border-color: #6366f1; }
        .submit-btn { align-self: flex-start; padding: 0.7rem 1.75rem; font-size: 0.95rem; }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
    </AppLayout>
  )
}

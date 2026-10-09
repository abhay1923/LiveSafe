import { useState } from 'react'
import { ExternalLink, RefreshCw, Check, X } from 'lucide-react'
import { api, type LiveSignal } from '@/app/services/api'
import { useApi } from '@/app/hooks/useApi'
import { useAuth } from '@/app/hooks/useAuth'

const STATUS_STYLE: Record<LiveSignal['verification_status'], string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-slate-100 text-slate-500 border-slate-200',
}

export default function LiveSignalsPanel() {
  const { user } = useAuth()
  const canRefresh = user?.role === 'admin' || user?.role === 'super_admin'
  const [filter, setFilter] = useState<'all' | LiveSignal['verification_status']>('all')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useApi((sig) =>
    api.getLiveSignals(filter === 'all' ? undefined : filter, sig)
  )
  const signals = data ?? []

  const review = async (id: string, decision: 'verified' | 'rejected') => {
    setBusy(id)
    setNotice(null)
    try {
      await api.reviewLiveSignal(id, decision)
      refetch()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not save review')
    } finally {
      setBusy(null)
    }
  }

  const refresh = async () => {
    setBusy('refresh')
    setNotice(null)
    try {
      const r = await api.refreshLiveSignals()
      const errText = r.errors.length ? ` ${r.errors.length} district(s) failed.` : ''
      setNotice(`Checked ${r.districts_queried} districts, added ${r.signals_added} new signal(s).${errText}`)
      refetch()
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Discovery failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="chart-card" style={{ gridColumn: '1 / -1' }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-base font-bold text-slate-800">Public Signals (TinyFish)</h3>
          <p className="text-xs text-slate-500">
            Web sources found for high-risk districts. Only signals confirmed here are shown as verified.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="text-xs border border-slate-300 rounded-md px-2 py-1"
          >
            <option value="all">All</option>
            <option value="pending">Pending review</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          {canRefresh && (
            <button
              onClick={refresh}
              disabled={busy !== null}
              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-800 text-white disabled:opacity-50"
            >
              <RefreshCw size={12} className={busy === 'refresh' ? 'animate-spin' : ''} />
              Check sources
            </button>
          )}
        </div>
      </div>

      {notice && <p className="text-xs text-slate-600 mb-3">{notice}</p>}
      {error && <p className="text-xs text-red-600 mb-3">Could not load signals: {error.message}</p>}
      {isLoading && <p className="text-xs text-slate-500">Loading signals…</p>}
      {!isLoading && !error && signals.length === 0 && (
        <p className="text-xs text-slate-500">
          No signals yet. {canRefresh ? 'Use "Check sources" to search public sources for the highest-risk districts.' : 'An administrator needs to run a source check.'}
        </p>
      )}

      <ul className="divide-y divide-slate-100">
        {signals.map((s) => (
          <li key={s.id} className="py-3 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[s.verification_status]}`}>
                {s.verification_status}
              </span>
              <span className="text-xs text-slate-500">{s.district}, {s.state}</span>
              <span className="text-xs text-slate-400">· {s.source_domain}</span>
            </div>
            <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-800 hover:underline flex items-center gap-1">
              {s.title} <ExternalLink size={12} />
            </a>
            {s.snippet && <p className="text-xs text-slate-600 line-clamp-2">{s.snippet}</p>}
            {s.verification_status === 'pending' && (
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => review(s.id, 'verified')}
                  disabled={busy !== null}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-emerald-600 text-white disabled:opacity-50"
                >
                  <Check size={12} /> Verify
                </button>
                <button
                  onClick={() => review(s.id, 'rejected')}
                  disabled={busy !== null}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-slate-200 text-slate-700 disabled:opacity-50"
                >
                  <X size={12} /> Reject
                </button>
              </div>
            )}
            {s.verified_by && (
              <p className="text-[11px] text-slate-400">Reviewed by {s.verified_by}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

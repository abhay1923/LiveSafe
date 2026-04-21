import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AccessRequest } from '@/app/services/api'
import { useAuth } from '@/app/hooks/useAuth'
import {
  Shield, Loader2, CheckCircle2, XCircle, Clock, AlertCircle,
  Briefcase, ShieldCheck, RefreshCw, ArrowLeft, Mail, Phone, Hash, FileText, LogOut,
} from 'lucide-react'

type Tab = 'pending' | 'approved' | 'rejected'

export default function SuperAdminRequestsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('pending')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError('')
      const data = await api.listAccessRequests(signal)
      setRequests(data)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Failed to load requests')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    load(ac.signal)
    const i = setInterval(() => load(), 10000)
    return () => { ac.abort(); clearInterval(i) }
  }, [load])

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3500)
  }

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this request and create their account?')) return
    setBusyId(id)
    try { await api.approveAccessRequest(id); showToast('Request approved. User can now sign in.'); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to approve') }
    finally { setBusyId(null) }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection (optional):') ?? undefined
    if (reason === null) return
    setBusyId(id)
    try { await api.rejectAccessRequest(id, reason || undefined); showToast('Request rejected.'); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to reject') }
    finally { setBusyId(null) }
  }

  const filtered = requests.filter(r => r.status === tab)
  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="sa-page">
      <header className="sa-header">
        <div className="sa-header-left">
          <button className="sa-back" onClick={() => navigate('/map')} title="Back to map">
            <ArrowLeft size={18}/>
          </button>
          <div className="sa-title">
            <Shield size={22} color="#a855f7" />
            <div>
              <h1>Super Admin — Access Requests</h1>
              <p>Review and approve police / admin applications</p>
            </div>
          </div>
        </div>
        <div className="sa-header-right">
          <span className="sa-user">{user?.name} ({user?.email})</span>
          <button className="sa-refresh" onClick={() => load()} title="Refresh"><RefreshCw size={16}/></button>
          <button className="sa-logout" onClick={logout} title="Sign out"><LogOut size={16}/></button>
        </div>
      </header>

      <div className="sa-tabs">
        {(['pending', 'approved', 'rejected'] as const).map(t => (
          <button key={t} className={`sa-tab ${tab===t?'active':''} ${t}`} onClick={()=>setTab(t)}>
            {t==='pending' && <Clock size={14}/>}
            {t==='approved' && <CheckCircle2 size={14}/>}
            {t==='rejected' && <XCircle size={14}/>}
            <span>{t.charAt(0).toUpperCase()+t.slice(1)}</span>
            <span className="sa-tab-count">{counts[t]}</span>
          </button>
        ))}
      </div>

      {toast && <div className="sa-toast"><CheckCircle2 size={16}/> {toast}</div>}
      {error && <div className="sa-error"><AlertCircle size={16}/> {error}</div>}

      <div className="sa-list">
        {loading ? (
          <div className="sa-empty"><Loader2 size={28} className="spin"/> Loading requests…</div>
        ) : filtered.length === 0 ? (
          <div className="sa-empty">
            {tab==='pending' ? 'No pending requests right now.' :
             tab==='approved' ? 'No approved requests yet.' : 'No rejected requests.'}
          </div>
        ) : (
          filtered.map(r => (
            <div key={r.id} className={`sa-card ${r.requested_role}`}>
              <div className="sa-card-head">
                <div className="sa-role-badge">
                  {r.requested_role === 'police'
                    ? <><ShieldCheck size={14}/> Police</>
                    : <><Briefcase size={14}/> Admin</>}
                </div>
                <span className="sa-time">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <h3 className="sa-name">{r.name}</h3>
              <div className="sa-rows">
                <div className="sa-row"><Mail size={13}/> {r.email}</div>
                {r.phone && <div className="sa-row"><Phone size={13}/> {r.phone}</div>}
                {r.badge_number && <div className="sa-row"><Hash size={13}/> Badge: {r.badge_number}</div>}
                {r.reason && <div className="sa-row sa-reason"><FileText size={13}/> {r.reason}</div>}
              </div>
              {r.status === 'pending' && (
                <div className="sa-actions">
                  <button className="sa-btn approve" disabled={busyId===r.id}
                    onClick={()=>handleApprove(r.id)}>
                    {busyId===r.id ? <Loader2 size={14} className="spin"/> : <CheckCircle2 size={14}/>}
                    Approve & Create Account
                  </button>
                  <button className="sa-btn reject" disabled={busyId===r.id}
                    onClick={()=>handleReject(r.id)}>
                    <XCircle size={14}/> Reject
                  </button>
                </div>
              )}
              {r.status === 'rejected' && r.rejection_reason && (
                <div className="sa-rejected-note">Rejected: {r.rejection_reason}</div>
              )}
              {r.status === 'approved' && r.reviewed_at && (
                <div className="sa-approved-note">Approved {new Date(r.reviewed_at).toLocaleString()}</div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .sa-page{min-height:100dvh;background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%);padding:1.25rem;color:#e2e8f0}
        .sa-header{display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap}
        .sa-header-left{display:flex;align-items:center;gap:.75rem}
        .sa-back{background:rgba(15,23,42,.6);border:1px solid #334155;border-radius:8px;padding:.4rem;color:#94a3b8;cursor:pointer;display:flex;align-items:center}
        .sa-back:hover{color:#e2e8f0;border-color:#6366f1}
        .sa-title{display:flex;align-items:center;gap:.6rem}
        .sa-title h1{margin:0;font-size:1.15rem;font-weight:700;color:#f1f5f9}
        .sa-title p{margin:0;font-size:.75rem;color:#64748b}
        .sa-header-right{display:flex;align-items:center;gap:.5rem}
        .sa-user{font-size:.75rem;color:#94a3b8;margin-right:.5rem}
        .sa-refresh,.sa-logout{background:rgba(15,23,42,.6);border:1px solid #334155;border-radius:8px;padding:.45rem;color:#94a3b8;cursor:pointer;display:flex;align-items:center}
        .sa-refresh:hover{color:#a5b4fc;border-color:#6366f1}
        .sa-logout:hover{color:#f87171;border-color:#ef4444}
        .sa-tabs{display:flex;gap:.5rem;margin-bottom:1rem;flex-wrap:wrap}
        .sa-tab{display:flex;align-items:center;gap:6px;padding:.55rem .9rem;border-radius:9px;font-size:.82rem;font-weight:600;cursor:pointer;background:rgba(15,23,42,.6);border:1px solid #334155;color:#94a3b8;transition:all .15s}
        .sa-tab:hover{color:#e2e8f0}
        .sa-tab.active.pending{background:rgba(245,158,11,.18);border-color:rgba(245,158,11,.5);color:#fbbf24}
        .sa-tab.active.approved{background:rgba(34,197,94,.18);border-color:rgba(34,197,94,.5);color:#4ade80}
        .sa-tab.active.rejected{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.5);color:#f87171}
        .sa-tab-count{background:rgba(0,0,0,.3);padding:1px 7px;border-radius:99px;font-size:.7rem}
        .sa-toast{display:flex;align-items:center;gap:8px;background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.4);color:#4ade80;padding:.6rem .85rem;border-radius:9px;margin-bottom:.75rem;font-size:.85rem}
        .sa-error{display:flex;align-items:center;gap:8px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;padding:.6rem .85rem;border-radius:9px;margin-bottom:.75rem;font-size:.85rem}
        .sa-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:.85rem}
        .sa-empty{grid-column:1/-1;padding:3rem 1rem;text-align:center;color:#64748b;font-size:.9rem;display:flex;align-items:center;justify-content:center;gap:8px}
        .sa-card{background:rgba(30,41,59,.7);border:1px solid #334155;border-radius:12px;padding:1rem;display:flex;flex-direction:column;gap:.6rem}
        .sa-card.police{border-left:3px solid #38bdf8}
        .sa-card.admin{border-left:3px solid #f59e0b}
        .sa-card-head{display:flex;justify-content:space-between;align-items:center}
        .sa-role-badge{display:flex;align-items:center;gap:5px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#cbd5e1;background:rgba(15,23,42,.6);padding:3px 8px;border-radius:6px}
        .sa-time{font-size:.7rem;color:#64748b}
        .sa-name{margin:0;font-size:1.05rem;font-weight:700;color:#f1f5f9}
        .sa-rows{display:flex;flex-direction:column;gap:4px}
        .sa-row{display:flex;align-items:center;gap:6px;font-size:.8rem;color:#94a3b8}
        .sa-reason{align-items:flex-start;line-height:1.4}
        .sa-actions{display:flex;gap:.5rem;margin-top:.4rem}
        .sa-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:.55rem .7rem;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;border:1px solid;transition:all .15s}
        .sa-btn:disabled{opacity:.6;cursor:wait}
        .sa-btn.approve{background:rgba(34,197,94,.18);border-color:rgba(34,197,94,.5);color:#4ade80}
        .sa-btn.approve:hover:not(:disabled){background:rgba(34,197,94,.3)}
        .sa-btn.reject{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.4);color:#f87171}
        .sa-btn.reject:hover:not(:disabled){background:rgba(239,68,68,.25)}
        .sa-rejected-note{font-size:.75rem;color:#f87171;background:rgba(239,68,68,.1);padding:.4rem .6rem;border-radius:6px}
        .sa-approved-note{font-size:.75rem;color:#4ade80;background:rgba(34,197,94,.1);padding:.4rem .6rem;border-radius:6px}
        .spin{animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  )
}

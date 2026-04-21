import React, { useState, type FormEvent } from 'react'
import { useAuth } from '@/app/hooks/useAuth'
import { api } from '@/app/services/api'
import {
  Shield, Eye, EyeOff, AlertCircle, Loader2, UserPlus, LogIn, CheckCircle2,
  ShieldCheck, Briefcase,
} from 'lucide-react'

const DEMO_ACCOUNTS = [
  { role: 'Citizen',     email: 'citizen@example.com',         password: 'citizen123',     color: '#22c55e' },
  { role: 'Police',      email: 'police@example.com',          password: 'police123',      color: '#38bdf8' },
  { role: 'Admin',       email: 'admin@example.com',           password: 'admin123',       color: '#f59e0b' },
  { role: 'Super Admin', email: 'superadmin@livesafe.local',   password: 'superadmin123',  color: '#a855f7' },
]

type Mode = 'signin' | 'signup-citizen' | 'request-police' | 'request-admin'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [badge, setBadge] = useState('')
  const [reason, setReason] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  const isRequest = mode === 'request-police' || mode === 'request-admin'

  const switchMode = (m: Mode) => {
    setMode(m); setError(''); setSuccess('')
    setEmail(''); setPassword(''); setConfirmPass(''); setName('')
    setPhone(''); setBadge(''); setReason('')
    setShowPw(false); setShowConfirm(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setSuccess('')

    if (mode === 'signin') {
      if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return }
      setLoading(true)
      try { await login(email.trim(), password) }
      catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed.') }
      finally { setLoading(false) }
      return
    }

    // signup-citizen and request-* share validation
    if (!name.trim())                  { setError('Please enter your full name.'); return }
    if (!email.trim())                 { setError('Please enter your email.'); return }
    if (password.length < 6)           { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPass)      { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      if (mode === 'signup-citizen') {
        await register(name.trim(), email.trim(), password)
        setSuccess('Account created! You are now signed in.')
      } else {
        const requestedRole = mode === 'request-police' ? 'police' : 'admin'
        if (requestedRole === 'police' && !badge.trim()) {
          setError('Badge / service number is required for police applications.')
          setLoading(false); return
        }
        await api.requestAccess({
          name: name.trim(), email: email.trim(), password,
          requestedRole, badgeNumber: badge.trim() || undefined,
          phone: phone.trim() || undefined, reason: reason.trim() || undefined,
        })
        setSuccess('Request submitted! The super admin will review your application. You can sign in once approved.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally { setLoading(false) }
  }

  const fillDemo = (demoEmail: string, pw: string) => { setEmail(demoEmail); setPassword(pw); setError('') }

  const titles: Record<Mode, { title: string; subtitle: string }> = {
    'signin':           { title: 'Welcome back',                 subtitle: 'Sign in to access real-time crime predictions' },
    'signup-citizen':   { title: 'Create a citizen account',     subtitle: 'Free account — instant access to safety features' },
    'request-police':   { title: 'Apply as Police Officer',      subtitle: 'Your request will be reviewed by the super admin' },
    'request-admin':    { title: 'Apply as Administrator',       subtitle: 'Your request will be reviewed by the super admin' },
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-container animate-fade-in">

        <div className="login-logo">
          <div className="logo-icon"><Shield size={32} color="#818cf8" /></div>
          <div>
            <h1>LiveSafe</h1>
            <p>Predictive Public Safety — All India</p>
          </div>
        </div>

        <div className="mode-tabs">
          <button type="button" className={`mode-tab${mode==='signin'?' active':''}`} onClick={()=>switchMode('signin')}>
            <LogIn size={15} /> Sign In
          </button>
          <button type="button" className={`mode-tab${mode==='signup-citizen'?' active':''}`} onClick={()=>switchMode('signup-citizen')}>
            <UserPlus size={15} /> Citizen Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-header">
            <h2>{titles[mode].title}</h2>
            <p className="form-subtitle">{titles[mode].subtitle}</p>
          </div>

          {success && <div className="login-success"><CheckCircle2 size={16} /> {success}</div>}
          {error   && <div className="login-error"><AlertCircle size={16} /> {error}</div>}

          {(mode==='signup-citizen' || isRequest) && (
            <div className="field-group">
              <label htmlFor="name">Full name</label>
              <input id="name" type="text" autoComplete="name" autoFocus placeholder="Rahul Sharma"
                value={name} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setName(e.target.value)} disabled={loading} />
            </div>
          )}

          <div className="field-group">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" autoFocus={mode==='signin'} placeholder="you@example.com"
              value={email} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setEmail(e.target.value)} disabled={loading} />
          </div>

          <div className="field-group">
            <label htmlFor="password">Password</label>
            <div className="pw-wrapper">
              <input id="password" type={showPw?'text':'password'}
                autoComplete={mode==='signin'?'current-password':'new-password'}
                placeholder={mode==='signin'?'••••••••':'Min. 6 characters'}
                value={password} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setPassword(e.target.value)} disabled={loading} />
              <button type="button" className="pw-toggle" onClick={()=>setShowPw(v=>!v)} tabIndex={-1}>
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          {(mode==='signup-citizen' || isRequest) && (
            <div className="field-group">
              <label htmlFor="confirm-password">Confirm password</label>
              <div className="pw-wrapper">
                <input id="confirm-password" type={showConfirm?'text':'password'} autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPass} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setConfirmPass(e.target.value)} disabled={loading} />
                <button type="button" className="pw-toggle" onClick={()=>setShowConfirm(v=>!v)} tabIndex={-1}>
                  {showConfirm ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              {confirmPass && (
                <span className={`pw-match ${password===confirmPass?'ok':'no'}`}>
                  {password===confirmPass ? '✓ Passwords match' : '✗ Passwords do not match'}
                </span>
              )}
            </div>
          )}

          {isRequest && (
            <>
              <div className="field-group">
                <label htmlFor="badge">
                  {mode==='request-police' ? 'Badge / Service number' : 'Employee ID (optional)'}
                </label>
                <input id="badge" type="text"
                  placeholder={mode==='request-police' ? 'e.g. DL-12345' : 'Internal employee identifier'}
                  value={badge} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setBadge(e.target.value)} disabled={loading} />
              </div>
              <div className="field-group">
                <label htmlFor="phone">Phone (optional)</label>
                <input id="phone" type="tel" placeholder="+91 98765 43210"
                  value={phone} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setPhone(e.target.value)} disabled={loading} />
              </div>
              <div className="field-group">
                <label htmlFor="reason">Reason / department (optional)</label>
                <textarea id="reason" rows={2}
                  placeholder="Briefly state your role and why you need access"
                  value={reason} onChange={(e:React.ChangeEvent<HTMLTextAreaElement>)=>setReason(e.target.value)} disabled={loading} />
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading
              ? <><Loader2 size={16} className="spin"/> Working…</>
              : mode==='signin'
                ? <><LogIn size={16}/> Sign In</>
                : mode==='signup-citizen'
                  ? <><UserPlus size={16}/> Create Account</>
                  : <><ShieldCheck size={16}/> Submit Application</>
            }
          </button>
        </form>

        {mode==='signin' && (
          <div className="role-apply">
            <p className="role-apply-label">Are you a police officer or administrator?</p>
            <div className="role-apply-row">
              <button type="button" className="role-apply-btn police" onClick={()=>switchMode('request-police')}>
                <ShieldCheck size={16}/> Apply as Police
              </button>
              <button type="button" className="role-apply-btn admin" onClick={()=>switchMode('request-admin')}>
                <Briefcase size={16}/> Apply as Admin
              </button>
            </div>
            <p className="role-apply-note">Your application will be reviewed by the super admin before access is granted.</p>
          </div>
        )}

        {isRequest && (
          <p className="switch-hint">
            Already have approved access?{' '}
            <button type="button" className="switch-link" onClick={()=>switchMode('signin')}>Back to sign in</button>
          </p>
        )}

        {mode==='signin' && (
          <div className="demo-section">
            <p className="demo-label">Demo accounts — click to fill:</p>
            <div className="demo-accounts">
              {DEMO_ACCOUNTS.map(a=>(
                <button key={a.role} type="button" className="demo-btn"
                  onClick={()=>fillDemo(a.email, a.password)}
                  style={{borderColor:a.color+'44','--accent':a.color} as React.CSSProperties}>
                  <span className="demo-role" style={{color:a.color}}>{a.role}</span>
                  <span className="demo-email">{a.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .login-page{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:1rem;position:relative;overflow:hidden}
        .login-bg{position:fixed;inset:0;background:radial-gradient(ellipse at 20% 50%,rgba(99,102,241,.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(245,158,11,.08) 0%,transparent 50%),linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%);z-index:-1}
        .login-container{width:100%;max-width:440px;display:flex;flex-direction:column;gap:1.1rem}
        .login-logo{display:flex;align-items:center;gap:1rem}
        .logo-icon{width:56px;height:56px;background:rgba(99,102,241,.15);border:1px solid rgba(129,140,248,.3);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .login-logo h1{margin:0;font-size:1.6rem;font-weight:800;color:#f1f5f9;letter-spacing:-.02em}
        .login-logo p{margin:0;font-size:.78rem;color:#64748b}
        .mode-tabs{display:flex;background:rgba(15,23,42,.6);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:4px;gap:4px}
        .mode-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:.6rem 1rem;border:none;border-radius:9px;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .18s;color:#64748b;background:transparent}
        .mode-tab:hover{color:#94a3b8}
        .mode-tab.active{background:rgba(99,102,241,.2);color:#a5b4fc;box-shadow:0 0 0 1px rgba(99,102,241,.4)}
        .login-form{background:rgba(30,41,59,.8);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:1.5rem;display:flex;flex-direction:column;gap:1rem}
        .form-header{display:flex;flex-direction:column;gap:4px}
        .login-form h2{margin:0;font-size:1.1rem;font-weight:700;color:#f1f5f9}
        .form-subtitle{margin:0;font-size:.8rem;color:#64748b}
        .login-error{display:flex;align-items:center;gap:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:.65rem .85rem;color:#f87171;font-size:.85rem}
        .login-success{display:flex;align-items:center;gap:8px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:.65rem .85rem;color:#4ade80;font-size:.85rem;line-height:1.4}
        .field-group{display:flex;flex-direction:column;gap:5px}
        .field-group label{font-size:.78rem;font-weight:600;color:#94a3b8;letter-spacing:.02em}
        .field-group input,.field-group textarea{background:rgba(15,23,42,.6);border:1px solid #334155;border-radius:8px;padding:.6rem .85rem;color:#f1f5f9;font-size:.88rem;outline:none;transition:border-color .15s;width:100%;box-sizing:border-box;font-family:inherit;resize:vertical}
        .field-group input:focus,.field-group textarea:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.2)}
        .field-group input:disabled,.field-group textarea:disabled{opacity:.6}
        .pw-wrapper{position:relative}
        .pw-wrapper input{padding-right:2.5rem}
        .pw-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;padding:2px;display:flex;align-items:center}
        .pw-toggle:hover{color:#94a3b8}
        .pw-match{font-size:.72rem;font-weight:600}
        .pw-match.ok{color:#4ade80}
        .pw-match.no{color:#f87171}
        .login-btn{width:100%;padding:.7rem;font-size:.92rem;display:flex;align-items:center;justify-content:center;gap:8px}
        .spin{animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .switch-hint{text-align:center;font-size:.8rem;color:#64748b;margin:0}
        .switch-link{background:none;border:none;color:#818cf8;font-size:.8rem;font-weight:600;cursor:pointer;text-decoration:underline;padding:0}
        .switch-link:hover{color:#a5b4fc}
        .role-apply{background:rgba(30,41,59,.5);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.95rem 1rem;display:flex;flex-direction:column;gap:.6rem}
        .role-apply-label{margin:0;font-size:.78rem;color:#cbd5e1;font-weight:600;text-align:center}
        .role-apply-row{display:flex;gap:.5rem}
        .role-apply-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:.55rem .65rem;border-radius:9px;font-size:.82rem;font-weight:600;cursor:pointer;background:rgba(15,23,42,.6);border:1px solid;transition:all .15s}
        .role-apply-btn.police{color:#7dd3fc;border-color:rgba(56,189,248,.3)}
        .role-apply-btn.police:hover{background:rgba(56,189,248,.15);border-color:rgba(56,189,248,.6)}
        .role-apply-btn.admin{color:#fbbf24;border-color:rgba(245,158,11,.3)}
        .role-apply-btn.admin:hover{background:rgba(245,158,11,.15);border-color:rgba(245,158,11,.6)}
        .role-apply-note{margin:0;font-size:.7rem;color:#64748b;text-align:center;line-height:1.5}
        .demo-section{background:rgba(30,41,59,.5);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:.85rem}
        .demo-label{margin:0 0 .65rem;font-size:.7rem;color:#64748b;text-align:center;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
        .demo-accounts{display:flex;flex-direction:column;gap:.4rem}
        .demo-btn{display:flex;align-items:center;gap:.75rem;background:rgba(15,23,42,.4);border:1px solid;border-radius:8px;padding:.5rem .8rem;cursor:pointer;text-align:left;transition:background .15s;width:100%}
        .demo-btn:hover{background:rgba(15,23,42,.7)}
        .demo-role{font-size:.75rem;font-weight:700;min-width:78px;letter-spacing:.02em}
        .demo-email{font-size:.75rem;color:#64748b}
      `}</style>
    </div>
  )
}

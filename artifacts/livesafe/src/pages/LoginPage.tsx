import React from 'react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/app/hooks/useAuth'
import { Shield, Eye, EyeOff, AlertCircle, Loader2, UserPlus, LogIn, CheckCircle2 } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { role: 'Citizen', email: 'citizen@example.com', password: 'citizen123', color: '#22c55e' },
  { role: 'Police',  email: 'police@example.com',  password: 'police123',  color: '#38bdf8' },
  { role: 'Admin',   email: 'admin@example.com',   password: 'admin123',   color: '#f59e0b' },
]

type Mode = 'signin' | 'signup'

export default function LoginPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [name, setName] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const switchMode = (m: Mode) => {
    setMode(m); setError(''); setEmail(''); setPassword('')
    setConfirmPass(''); setName(''); setShowPw(false); setShowConfirm(false); setSuccess(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (mode === 'signup') {
      if (!name.trim())         { setError('Please enter your full name.'); return }
      if (!email.trim())        { setError('Please enter your email.'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
      if (password !== confirmPass) { setError('Passwords do not match.'); return }
      setLoading(true)
      try { await register(name.trim(), email.trim(), password); setSuccess(true) }
      catch (err) { setError(err instanceof Error ? err.message : 'Sign up failed.') }
      finally { setLoading(false) }
    } else {
      if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return }
      setLoading(true)
      try { await login(email.trim(), password) }
      catch (err) { setError(err instanceof Error ? err.message : 'Sign in failed.') }
      finally { setLoading(false) }
    }
  }

  const fillDemo = (demoEmail: string, pw: string) => { setEmail(demoEmail); setPassword(pw); setError('') }

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
          <button type="button" className={`mode-tab${mode==='signup'?' active':''}`} onClick={()=>switchMode('signup')}>
            <UserPlus size={15} /> Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div className="form-header">
            <h2>{mode==='signin' ? 'Welcome back' : 'Create your account'}</h2>
            <p className="form-subtitle">
              {mode==='signin' ? 'Sign in to access real-time crime predictions' : 'Join LiveSafe to monitor safety in your area'}
            </p>
          </div>

          {success && <div className="login-success"><CheckCircle2 size={16} /> Account created! You are now signed in.</div>}
          {error   && <div className="login-error"><AlertCircle size={16} /> {error}</div>}

          {mode==='signup' && (
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
                placeholder={mode==='signup'?'Min. 6 characters':'••••••••'}
                value={password} onChange={(e:React.ChangeEvent<HTMLInputElement>)=>setPassword(e.target.value)} disabled={loading} />
              <button type="button" className="pw-toggle" onClick={()=>setShowPw(v=>!v)} tabIndex={-1}>
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          {mode==='signup' && (
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

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading
              ? <><Loader2 size={16} className="spin"/> {mode==='signin'?'Signing in…':'Creating account…'}</>
              : mode==='signin'
                ? <><LogIn size={16}/> Sign In</>
                : <><UserPlus size={16}/> Create Account</>
            }
          </button>

          <p className="switch-hint">
            {mode==='signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button type="button" className="switch-link" onClick={()=>switchMode(mode==='signin'?'signup':'signin')}>
              {mode==='signin' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </form>

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

        {mode==='signup' && (
          <p className="signup-note">
            New accounts are registered as <strong>Citizen</strong> role. Your credentials are stored locally in this browser for demo purposes.
          </p>
        )}
      </div>

      <style>{`
        .login-page{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:1rem;position:relative;overflow:hidden}
        .login-bg{position:fixed;inset:0;background:radial-gradient(ellipse at 20% 50%,rgba(99,102,241,.15) 0%,transparent 60%),radial-gradient(ellipse at 80% 20%,rgba(245,158,11,.08) 0%,transparent 50%),linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%);z-index:-1}
        .login-container{width:100%;max-width:420px;display:flex;flex-direction:column;gap:1.25rem}
        .login-logo{display:flex;align-items:center;gap:1rem}
        .logo-icon{width:56px;height:56px;background:rgba(99,102,241,.15);border:1px solid rgba(129,140,248,.3);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .login-logo h1{margin:0;font-size:1.6rem;font-weight:800;color:#f1f5f9;letter-spacing:-.02em}
        .login-logo p{margin:0;font-size:.78rem;color:#64748b}
        .mode-tabs{display:flex;background:rgba(15,23,42,.6);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:4px;gap:4px}
        .mode-tab{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:.6rem 1rem;border:none;border-radius:9px;font-size:.875rem;font-weight:600;cursor:pointer;transition:all .18s;color:#64748b;background:transparent}
        .mode-tab:hover{color:#94a3b8}
        .mode-tab.active{background:rgba(99,102,241,.2);color:#a5b4fc;box-shadow:0 0 0 1px rgba(99,102,241,.4)}
        .login-form{background:rgba(30,41,59,.8);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:1.75rem;display:flex;flex-direction:column;gap:1.1rem}
        .form-header{display:flex;flex-direction:column;gap:4px}
        .login-form h2{margin:0;font-size:1.1rem;font-weight:700;color:#f1f5f9}
        .form-subtitle{margin:0;font-size:.8rem;color:#64748b}
        .login-error{display:flex;align-items:center;gap:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:.65rem .85rem;color:#f87171;font-size:.85rem}
        .login-success{display:flex;align-items:center;gap:8px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:.65rem .85rem;color:#4ade80;font-size:.85rem}
        .field-group{display:flex;flex-direction:column;gap:5px}
        .field-group label{font-size:.8rem;font-weight:600;color:#94a3b8;letter-spacing:.02em}
        .field-group input{background:rgba(15,23,42,.6);border:1px solid #334155;border-radius:8px;padding:.65rem .9rem;color:#f1f5f9;font-size:.9rem;outline:none;transition:border-color .15s;width:100%;box-sizing:border-box}
        .field-group input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.2)}
        .field-group input:disabled{opacity:.6}
        .pw-wrapper{position:relative}
        .pw-wrapper input{padding-right:2.5rem}
        .pw-toggle{position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:#64748b;cursor:pointer;padding:2px;display:flex;align-items:center}
        .pw-toggle:hover{color:#94a3b8}
        .pw-match{font-size:.75rem;font-weight:600}
        .pw-match.ok{color:#4ade80}
        .pw-match.no{color:#f87171}
        .login-btn{width:100%;padding:.75rem;font-size:.95rem;display:flex;align-items:center;justify-content:center;gap:8px}
        .spin{animation:spin .8s linear infinite}
        .switch-hint{text-align:center;font-size:.82rem;color:#64748b;margin:0}
        .switch-link{background:none;border:none;color:#818cf8;font-size:.82rem;font-weight:600;cursor:pointer;text-decoration:underline;padding:0}
        .switch-link:hover{color:#a5b4fc}
        .demo-section{background:rgba(30,41,59,.5);border:1px solid rgba(255,255,255,.05);border-radius:12px;padding:1rem}
        .demo-label{margin:0 0 .75rem;font-size:.75rem;color:#64748b;text-align:center;text-transform:uppercase;letter-spacing:.05em;font-weight:600}
        .demo-accounts{display:flex;flex-direction:column;gap:.5rem}
        .demo-btn{display:flex;align-items:center;gap:.75rem;background:rgba(15,23,42,.4);border:1px solid;border-radius:8px;padding:.55rem .85rem;cursor:pointer;text-align:left;transition:background .15s;width:100%}
        .demo-btn:hover{background:rgba(15,23,42,.7)}
        .demo-role{font-size:.8rem;font-weight:700;min-width:52px;letter-spacing:.02em}
        .demo-email{font-size:.8rem;color:#64748b}
        .signup-note{text-align:center;font-size:.78rem;color:#475569;margin:0;padding:0 .5rem;line-height:1.5}
        .signup-note strong{color:#64748b}
      `}</style>
    </div>
  )
}

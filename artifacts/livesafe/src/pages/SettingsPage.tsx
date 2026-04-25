import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/app/hooks/useAuth'
import EmergencyContactsCard from '@/components/EmergencyContactsCard'
import { User, Shield, Bell, Eye, LogOut } from 'lucide-react'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const isCitizen = user?.role === 'citizen'

  return (
    <AppLayout title="Settings" subtitle="Account and application preferences">
      <div className="settings-page">
        {/* Profile card */}
        <div className="settings-section">
          <h2><User size={16} /> Profile</h2>
          <div className="settings-card">
            <div className="profile-row">
              <div className="profile-avatar">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="profile-info">
                <div className="profile-name">{user?.name}</div>
                <div className="profile-email">{user?.email}</div>
                <div className="profile-role-badge">{user?.role}</div>
              </div>
            </div>
            {user?.badge_number && (
              <div className="settings-row">
                <span className="settings-label">Badge Number</span>
                <span className="settings-value">{user.badge_number}</span>
              </div>
            )}
            {user?.phone && (
              <div className="settings-row">
                <span className="settings-label">Phone</span>
                <span className="settings-value">{user.phone}</span>
              </div>
            )}
            <div className="settings-row">
              <span className="settings-label">Account Status</span>
              <span className="settings-value active">Active</span>
            </div>
          </div>
        </div>

        {/* App info */}
        <div className="settings-section">
          <h2><Shield size={16} /> Application</h2>
          <div className="settings-card">
            <div className="settings-row">
              <span className="settings-label">App Version</span>
              <span className="settings-value">{__APP_VERSION__}</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Build Time</span>
              <span className="settings-value">{new Date(__BUILD_TIME__).toLocaleDateString()}</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Environment</span>
              <span className="settings-value">{import.meta.env.MODE}</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Data Mode</span>
              <span className="settings-value">Demo (Mock Data)</span>
            </div>
          </div>
        </div>

        {/* Notifications placeholder */}
        <div className="settings-section">
          <h2><Bell size={16} /> Notifications</h2>
          <div className="settings-card">
            <div className="settings-toggle-row">
              <div>
                <div className="toggle-label">SOS Alert Notifications</div>
                <div className="toggle-sub">Receive browser notifications for new SOS alerts</div>
              </div>
              <div className="toggle-chip active">Enabled</div>
            </div>
            <div className="settings-toggle-row">
              <div>
                <div className="toggle-label">Hotspot Updates</div>
                <div className="toggle-sub">Notify when new critical hotspots are detected</div>
              </div>
              <div className="toggle-chip">Disabled</div>
            </div>
          </div>
        </div>

        {isCitizen && (
          <div className="settings-section">
            <EmergencyContactsCard
              title="SOS WhatsApp Contacts"
              description="These contacts can be notified when you trigger an SOS alert from the citizen safety tools."
            />
          </div>
        )}

        {/* Privacy */}
        <div className="settings-section">
          <h2><Eye size={16} /> Privacy &amp; Security</h2>
          <div className="settings-card">
            <div className="settings-row">
              <span className="settings-label">Session storage</span>
              <span className="settings-value">sessionStorage (tab-scoped)</span>
            </div>
            <div className="settings-row">
              <span className="settings-label">Data retention</span>
              <span className="settings-value">Session only — cleared on tab close</span>
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button className="btn btn-ghost sign-out-btn" onClick={() => logout()}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>

      <style>{`
        .settings-page { max-width: 600px; display: flex; flex-direction: column; gap: 1.5rem; }
        .settings-section { display: flex; flex-direction: column; gap: 0.75rem; }
        .settings-section h2 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.88rem;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 0;
        }
        .settings-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          overflow: hidden;
        }
        .profile-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .profile-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(99,102,241,0.2);
          border: 2px solid rgba(129,140,248,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          font-weight: 700;
          color: #818cf8;
          flex-shrink: 0;
        }
        .profile-name { font-size: 1rem; font-weight: 700; color: #f1f5f9; }
        .profile-email { font-size: 0.8rem; color: #64748b; margin: 2px 0; }
        .profile-role-badge {
          display: inline-block;
          background: rgba(99,102,241,0.15);
          color: #818cf8;
          border: 1px solid rgba(129,140,248,0.3);
          padding: 1px 8px;
          border-radius: 9999px;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .settings-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          font-size: 0.84rem;
        }
        .settings-row:last-child { border-bottom: none; }
        .settings-label { color: #94a3b8; }
        .settings-value { color: #f1f5f9; font-weight: 500; }
        .settings-value.active { color: #22c55e; }
        .settings-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .settings-toggle-row:last-child { border-bottom: none; }
        .toggle-label { font-size: 0.85rem; color: #f1f5f9; font-weight: 500; }
        .toggle-sub { font-size: 0.75rem; color: #64748b; margin-top: 2px; }
        .toggle-chip {
          padding: 2px 10px;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 700;
          background: rgba(255,255,255,0.05);
          color: #64748b;
          border: 1px solid rgba(255,255,255,0.07);
          white-space: nowrap;
        }
        .toggle-chip.active { background: rgba(34,197,94,0.1); color: #22c55e; border-color: rgba(34,197,94,0.25); }
        .sign-out-btn { align-self: flex-start; color: #f87171; border-color: rgba(239,68,68,0.25); }
        .sign-out-btn:hover { background: rgba(239,68,68,0.1); }
      `}</style>
    </AppLayout>
  )
}

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/app/hooks/useAuth'
import { api } from '@/app/services/api'
import type { EmergencyContact } from '@/types'
import { User, Shield, Bell, Eye, LogOut, MessageCircle, Plus, Trash2, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const isCitizen = user?.role === 'citizen'
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCitizen) return
    setLoadingContacts(true)
    api
      .getEmergencyContacts()
      .then((rows) => {
        setContacts(rows)
        setError(null)
      })
      .catch((e) => {
        setError((e as Error).message)
      })
      .finally(() => setLoadingContacts(false))
  }, [isCitizen])

  const handleAddContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) return
    setSavingContact(true)
    try {
      const created = await api.addEmergencyContact({
        name: contactName.trim(),
        phone: contactPhone.trim(),
      })
      setContacts((prev) => [created, ...prev])
      setContactName('')
      setContactPhone('')
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSavingContact(false)
    }
  }

  const handleDeleteContact = async (id: string) => {
    try {
      await api.deleteEmergencyContact(id)
      setContacts((prev) => prev.filter((c) => c.id !== id))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

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
              <span className="settings-value">API-backed real data</span>
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
            <h2><MessageCircle size={16} /> SOS WhatsApp Contacts</h2>
            <div className="settings-card">
              <div className="contact-form">
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact name"
                  className="contact-input"
                />
                <input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="WhatsApp number (e.g. +919876543210)"
                  className="contact-input"
                />
                <button
                  className="contact-add-btn"
                  onClick={handleAddContact}
                  disabled={savingContact || !contactName.trim() || !contactPhone.trim()}
                >
                  {savingContact ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                  Add Contact
                </button>
              </div>

              {loadingContacts ? (
                <div className="contacts-empty"><Loader2 size={16} className="spin" /> Loading contacts…</div>
              ) : contacts.length === 0 ? (
                <div className="contacts-empty">No emergency contacts yet. Add at least one to receive SOS WhatsApp alerts.</div>
              ) : (
                contacts.map((contact) => (
                  <div key={contact.id} className="contact-row">
                    <div>
                      <div className="contact-name">{contact.name}</div>
                      <div className="contact-phone">{contact.phone}</div>
                    </div>
                    <button className="contact-del-btn" onClick={() => handleDeleteContact(contact.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
              {error && <div className="contact-error">{error}</div>}
            </div>
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
        .contact-form {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 0.5rem;
          padding: 0.9rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .contact-input {
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 0.55rem 0.7rem;
          color: #f1f5f9;
          font-size: 0.8rem;
          outline: none;
        }
        .contact-input:focus { border-color: rgba(129,140,248,0.6); }
        .contact-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          border: 1px solid rgba(34,197,94,0.35);
          background: rgba(34,197,94,0.14);
          color: #22c55e;
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
        }
        .contact-add-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .contact-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .contact-row:last-of-type { border-bottom: none; }
        .contact-name { color: #f1f5f9; font-size: 0.82rem; font-weight: 600; }
        .contact-phone { color: #94a3b8; font-size: 0.75rem; margin-top: 2px; }
        .contact-del-btn {
          border: 1px solid rgba(239,68,68,0.28);
          background: rgba(239,68,68,0.1);
          color: #f87171;
          border-radius: 7px;
          width: 30px;
          height: 30px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .contacts-empty {
          padding: 0.9rem 1rem;
          color: #94a3b8;
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .contact-error {
          color: #f87171;
          font-size: 0.75rem;
          padding: 0.7rem 1rem 0.9rem;
          border-top: 1px solid rgba(239,68,68,0.16);
          background: rgba(239,68,68,0.06);
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .contact-form { grid-template-columns: 1fr; }
        }
      `}</style>
    </AppLayout>
  )
}

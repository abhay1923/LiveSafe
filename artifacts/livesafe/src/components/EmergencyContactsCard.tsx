import { useEffect, useState } from 'react'
import { api } from '@/app/services/api'
import type { EmergencyContact } from '@/types'
import { MessageCircle, Plus, Trash2, Loader2, ShieldAlert } from 'lucide-react'

interface EmergencyContactsCardProps {
  title?: string
  description?: string
  compact?: boolean
}

export default function EmergencyContactsCard({
  title = 'SOS Emergency Contacts',
  description = 'Add trusted contacts who should receive emergency updates when you trigger SOS.',
  compact = false,
}: EmergencyContactsCardProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [savingContact, setSavingContact] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoadingContacts(true)
    api
      .getEmergencyContacts()
      .then((rows) => {
        if (!mounted) return
        setContacts(rows)
        setError(null)
      })
      .catch((e) => {
        if (!mounted) return
        setError((e as Error).message)
      })
      .finally(() => {
        if (!mounted) return
        setLoadingContacts(false)
      })

    return () => {
      mounted = false
    }
  }, [])

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
    <div className={`ec-card ${compact ? 'compact' : ''}`}>
      <div className="ec-header">
        <div>
          <h3>
            <MessageCircle size={16} />
            {title}
          </h3>
          <p>{description}</p>
        </div>
        <div className={`ec-count ${contacts.length > 0 ? 'ready' : ''}`}>
          {contacts.length} saved
        </div>
      </div>

      <div className="ec-tip">
        <ShieldAlert size={14} />
        <span>Use WhatsApp-ready numbers with country code, for example `+919876543210`.</span>
      </div>

      <div className="ec-form">
        <input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder="Contact name"
          className="ec-input"
        />
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="WhatsApp number"
          className="ec-input"
        />
        <button
          className="ec-add-btn"
          onClick={handleAddContact}
          disabled={savingContact || !contactName.trim() || !contactPhone.trim()}
        >
          {savingContact ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>

      {loadingContacts ? (
        <div className="ec-empty">
          <Loader2 size={16} className="spin" />
          Loading contacts...
        </div>
      ) : contacts.length === 0 ? (
        <div className="ec-empty">
          No safety contacts yet. Add at least one so SOS updates can reach someone you trust.
        </div>
      ) : (
        <div className="ec-list">
          {contacts.map((contact) => (
            <div key={contact.id} className="ec-row">
              <div>
                <div className="ec-name">{contact.name}</div>
                <div className="ec-phone">{contact.phone}</div>
              </div>
              <button className="ec-del-btn" onClick={() => handleDeleteContact(contact.id)} title="Delete contact">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <div className="ec-error">{error}</div>}

      <style>{`
        .ec-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px;
          overflow: hidden;
        }
        .ec-card.compact {
          border-radius: 14px;
        }
        .ec-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1rem 0.9rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .ec-header h3 {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.9rem;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
        }
        .ec-header p {
          margin: 0.35rem 0 0;
          font-size: 0.75rem;
          color: #94a3b8;
          line-height: 1.5;
          max-width: 440px;
        }
        .ec-count {
          white-space: nowrap;
          padding: 0.25rem 0.6rem;
          border-radius: 9999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: #94a3b8;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .ec-count.ready {
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.22);
          color: #86efac;
        }
        .ec-tip {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin: 0.9rem 1rem 0;
          padding: 0.65rem 0.75rem;
          border-radius: 10px;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.15);
          color: #bfdbfe;
          font-size: 0.74rem;
          line-height: 1.5;
        }
        .ec-form {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 0.5rem;
          padding: 0.9rem 1rem;
        }
        .ec-input {
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 0.55rem 0.7rem;
          color: #f1f5f9;
          font-size: 0.8rem;
          outline: none;
        }
        .ec-input:focus {
          border-color: rgba(129,140,248,0.6);
        }
        .ec-add-btn {
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
        .ec-add-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .ec-list {
          border-top: 1px solid rgba(255,255,255,0.03);
        }
        .ec-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-top: 1px solid rgba(255,255,255,0.03);
        }
        .ec-row:first-child {
          border-top: none;
        }
        .ec-name {
          color: #f1f5f9;
          font-size: 0.82rem;
          font-weight: 600;
        }
        .ec-phone {
          color: #94a3b8;
          font-size: 0.75rem;
          margin-top: 2px;
        }
        .ec-del-btn {
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
        .ec-empty {
          padding: 0.95rem 1rem 1rem;
          color: #94a3b8;
          font-size: 0.78rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .ec-error {
          color: #f87171;
          font-size: 0.75rem;
          padding: 0.7rem 1rem 0.9rem;
          border-top: 1px solid rgba(239,68,68,0.16);
          background: rgba(239,68,68,0.06);
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .ec-form {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

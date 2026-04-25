import React from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { Users, Search, UserCheck, UserX, Hash } from "lucide-react"
import { useState } from 'react'
import type { User, UserRole } from '@/types'

const MOCK_USERS: User[] = [
  { id: '1', email: 'citizen@example.com', name: 'Arjun Mehta',    role: 'citizen', phone: '+91-9876543210', is_active: true,  created_at: '2024-01-15T00:00:00Z' },
  { id: '2', email: 'police@example.com',  name: 'Inspector Singh', role: 'police',  badge_number: 'BD-2024-001', is_active: true,  created_at: '2024-01-10T00:00:00Z' },
  { id: '3', email: 'admin@example.com',   name: 'Admin User',      role: 'admin',   is_active: true,  created_at: '2024-01-01T00:00:00Z' },
  { id: '4', email: 'priya@example.com',   name: 'Priya Sharma',   role: 'citizen', phone: '+91-9812345678', is_active: true,  created_at: '2024-02-05T00:00:00Z' },
  { id: '5', email: 'rahul@example.com',   name: 'Rahul Gupta',    role: 'citizen', is_active: false, created_at: '2024-02-12T00:00:00Z' },
  { id: '6', email: 'kumar@example.com',   name: 'Officer Kumar',  role: 'police',  badge_number: 'BD-2024-002', is_active: true,  created_at: '2024-02-18T00:00:00Z' },
]

const ROLE_COLORS: Record<UserRole, string> = {
  citizen: '#22c55e',
  police:  '#38bdf8',
  admin:   '#f59e0b',
  super_admin: '#a855f7',
}

export default function UserManagementPage() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  const filtered = MOCK_USERS.filter((u) => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                          u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  return (
    <AppLayout title="User Management" subtitle="Manage platform users and roles">
      <div className="users-page">
        {/* Stats */}
        <div className="users-stats">
          {(['citizen', 'police', 'admin'] as UserRole[]).map((r) => {
            const count = MOCK_USERS.filter((u) => u.role === r).length
            return (
              <div key={r} className="user-stat-card">
                <span className="user-stat-icon">{r === 'citizen' ? '👤' : r === 'police' ? '🚔' : '⚙️'}</span>
                <div>
                  <div className="user-stat-val">{count}</div>
                  <div className="user-stat-lbl" style={{ color: ROLE_COLORS[r] }}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}s
                  </div>
                </div>
              </div>
            )
          })}
          <div className="user-stat-card">
            <Users size={22} color="#94a3b8" />
            <div>
              <div className="user-stat-val">{MOCK_USERS.length}</div>
              <div className="user-stat-lbl">Total Users</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="users-filters">
          <div className="search-box">
            <Search size={15} color="#64748b" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
          </div>
          <div className="role-filters">
            {(['all', 'citizen', 'police', 'admin'] as const).map((r) => (
              <button
                key={r}
                className={`role-filter-btn ${roleFilter === r ? 'active' : ''}`}
                onClick={() => setRoleFilter(r)}
                style={roleFilter === r && r !== 'all' ? { borderColor: ROLE_COLORS[r], color: ROLE_COLORS[r], background: ROLE_COLORS[r] + '18' } : {}}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Badge / Phone</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-av" style={{ background: ROLE_COLORS[u.role] + '22', borderColor: ROLE_COLORS[u.role] + '44' }}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className="user-cell-name">{u.name}</div>
                        <div className="user-cell-email">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="role-badge" style={{ color: ROLE_COLORS[u.role], background: ROLE_COLORS[u.role] + '18', borderColor: ROLE_COLORS[u.role] + '44' }}>
                      {u.role}
                    </span>
                  </td>
                  <td className="meta-cell">
                    {u.badge_number
                      ? <span className="badge-num"><Hash size={11} /> {u.badge_number}</span>
                      : u.phone ?? '—'
                    }
                  </td>
                  <td className="date-cell">{new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                  <td>
                    {u.is_active
                      ? <span className="status-chip active"><UserCheck size={11} /> Active</span>
                      : <span className="status-chip inactive"><UserX size={11} /> Inactive</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="no-users">No users match your search.</div>
          )}
        </div>
      </div>

      <style>{`
        .users-page { display: flex; flex-direction: column; gap: 1.25rem; }
        .users-stats {
          display: flex;
          gap: 0.85rem;
          flex-wrap: wrap;
        }
        .user-stat-card {
          flex: 1;
          min-width: 130px;
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 10px;
          padding: 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .user-stat-icon { font-size: 1.4rem; flex-shrink: 0; }
        .user-stat-val { font-size: 1.4rem; font-weight: 800; color: #f1f5f9; line-height: 1; }
        .user-stat-lbl { font-size: 0.72rem; color: #64748b; margin-top: 2px; font-weight: 600; }
        .users-filters { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
        .search-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(30,41,59,0.8);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          padding: 0.45rem 0.85rem;
          flex: 1;
          min-width: 220px;
        }
        .search-box input {
          background: none;
          border: none;
          outline: none;
          color: #f1f5f9;
          font-size: 0.85rem;
          width: 100%;
        }
        .search-box input::placeholder { color: #64748b; }
        .role-filters { display: flex; gap: 0.4rem; flex-wrap: wrap; }
        .role-filter-btn {
          padding: 0.4rem 0.85rem;
          border-radius: 7px;
          background: rgba(30,41,59,0.6);
          border: 1px solid rgba(255,255,255,0.07);
          color: #94a3b8;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 500;
          transition: all 0.15s;
          text-transform: capitalize;
        }
        .role-filter-btn:hover { background: rgba(255,255,255,0.05); color: #f1f5f9; }
        .role-filter-btn.active { font-weight: 700; }
        .users-table-wrapper {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          overflow: auto;
        }
        .users-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.84rem;
        }
        .users-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.72rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          white-space: nowrap;
        }
        .users-table td {
          padding: 0.85rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          color: #94a3b8;
          vertical-align: middle;
        }
        .users-table tr:last-child td { border-bottom: none; }
        .users-table tr:hover td { background: rgba(255,255,255,0.02); }
        .user-cell { display: flex; align-items: center; gap: 0.65rem; }
        .user-av {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.85rem;
          color: #f1f5f9;
          flex-shrink: 0;
        }
        .user-cell-name { font-size: 0.85rem; font-weight: 600; color: #f1f5f9; }
        .user-cell-email { font-size: 0.73rem; color: #64748b; }
        .role-badge {
          display: inline-block;
          padding: 2px 9px;
          border-radius: 9999px;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: capitalize;
          border: 1px solid;
          letter-spacing: 0.03em;
        }
        .meta-cell { font-size: 0.78rem; }
        .badge-num { display: flex; align-items: center; gap: 4px; color: #818cf8; font-family: monospace; }
        .date-cell { font-size: 0.78rem; white-space: nowrap; }
        .status-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 9px;
          border-radius: 9999px;
          font-size: 0.7rem;
          font-weight: 700;
        }
        .status-chip.active   { background: rgba(34,197,94,0.1);  color: #22c55e; }
        .status-chip.inactive { background: rgba(239,68,68,0.1);  color: #f87171; }
        .no-users {
          padding: 3rem;
          text-align: center;
          color: #64748b;
          font-size: 0.85rem;
        }
      `}</style>
    </AppLayout>
  )
}

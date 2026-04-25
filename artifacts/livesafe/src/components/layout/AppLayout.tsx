import { type ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/hooks/useAuth'
import {
  Shield, Map, AlertTriangle, BarChart3, Users, Settings,
  Bell, LogOut, Menu, X, Activity, ChevronRight,
} from 'lucide-react'
import type { UserRole } from '@/types'

interface NavItem {
  label: string
  path: string
  icon: ReactNode
  roles: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Hotspot Map',    path: '/map',        icon: <Map size={18} />,           roles: ['citizen', 'police', 'admin'] },
  { label: 'Report Incident',path: '/report',     icon: <AlertTriangle size={18} />, roles: ['citizen'] },
  { label: 'SOS Alerts',     path: '/sos',        icon: <Bell size={18} />,          roles: ['police', 'admin'] },
  { label: 'Analytics',      path: '/analytics',  icon: <BarChart3 size={18} />,     roles: ['police', 'admin'] },
  { label: 'ML Dashboard',   path: '/ml',         icon: <Activity size={18} />,      roles: ['admin'] },
  { label: 'User Management',path: '/users',      icon: <Users size={18} />,         roles: ['admin'] },
  { label: 'Settings',       path: '/settings',   icon: <Settings size={18} />,      roles: ['citizen', 'police', 'admin'] },
]

const ROLE_COLORS: Record<UserRole, string> = {
  citizen: '#22c55e',
  police:  '#38bdf8',
  admin:   '#f59e0b',
  super_admin: '#a855f7',
}

interface LayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

export default function AppLayout({ children, title, subtitle }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const visibleNav = NAV_ITEMS.filter((n) =>
    user ? n.roles.includes(user.role) : false
  )

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const roleColor = user ? ROLE_COLORS[user.role] : '#818cf8'

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Shield size={22} color="#818cf8" />
            <span>LiveSafe</span>
          </div>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* User card */}
        {user && (
          <div className="user-card">
            <div className="user-avatar" style={{ background: `${roleColor}22`, borderColor: `${roleColor}44` }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role" style={{ color: roleColor }}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                {user.badge_number ? ` · ${user.badge_number}` : ''}
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              <ChevronRight size={14} className="nav-chevron" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="main">
        {/* Top bar */}
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar-actions">
            <div className="status-dot" title="System operational" />
            <span className="status-text">Live</span>
          </div>
        </header>

        {/* Page content */}
        <main className="content">
          {children}
        </main>
      </div>

      <style>{`
        .layout {
          display: flex;
          min-height: 100dvh;
          position: relative;
        }
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 40;
          backdrop-filter: blur(2px);
        }
        .sidebar {
          width: 240px;
          min-height: 100dvh;
          background: #1e293b;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100dvh;
          overflow-y: auto;
          z-index: 50;
          flex-shrink: 0;
          transition: transform 0.25s ease;
        }
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            transform: translateX(-100%);
          }
          .sidebar.open { transform: translateX(0); }
        }
        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1rem 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.1rem;
          font-weight: 800;
          color: #f1f5f9;
          letter-spacing: -0.02em;
        }
        .close-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          display: none;
        }
        @media (max-width: 768px) { .close-btn { display: flex; } }
        .user-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .user-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1.5px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.9rem;
          color: #f1f5f9;
          flex-shrink: 0;
        }
        .user-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .user-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-role { font-size: 0.72rem; font-weight: 600; }
        .sidebar-nav {
          flex: 1;
          padding: 0.75rem 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 500;
          color: #94a3b8;
          text-decoration: none;
          transition: all 0.15s;
          position: relative;
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: #f1f5f9; }
        .nav-item.active { background: rgba(99,102,241,0.15); color: #818cf8; font-weight: 600; }
        .nav-icon { flex-shrink: 0; }
        .nav-label { flex: 1; }
        .nav-chevron { opacity: 0; transition: opacity 0.15s; }
        .nav-item:hover .nav-chevron { opacity: 0.4; }
        .nav-item.active .nav-chevron { opacity: 0.6; }
        .sidebar-footer {
          padding: 1rem;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.55rem 0.75rem;
          background: none;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 8px;
          color: #94a3b8;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.15s;
        }
        .logout-btn:hover { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.3); }
        .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .topbar {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 1.5rem;
          background: rgba(30,41,59,0.7);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          position: sticky;
          top: 0;
          z-index: 30;
        }
        .menu-btn {
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 4px;
          display: none;
          align-items: center;
        }
        @media (max-width: 768px) { .menu-btn { display: flex; } }
        .topbar-title { flex: 1; }
        .topbar-title h1 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: #f1f5f9;
        }
        .topbar-title p { margin: 0; font-size: 0.75rem; color: #64748b; }
        .topbar-actions { display: flex; align-items: center; gap: 6px; }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          animation: pulse-ring 2s ease-out infinite;
          box-shadow: 0 0 0 0 rgba(34,197,94,0.5);
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
          70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        .status-text { font-size: 0.75rem; font-weight: 600; color: #22c55e; }
        .content { flex: 1; padding: 1.5rem; overflow-x: hidden; }
        @media (max-width: 640px) { .content { padding: 1rem; } }
      `}</style>
    </div>
  )
}
